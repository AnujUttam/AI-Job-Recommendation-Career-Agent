import { Job } from '../models/Job.js';
import { Resume } from '../models/Resume.js';
import { semanticSearchByCandidate } from './aiVectorService.js';

const EXP_RANK = {
  'Student / Intern': 0,
  'Entry Level (0-2 yrs)': 1,
  'Mid Level (2-5 yrs)': 2,
  'Senior (5+ yrs)': 3,
};

const collectUserSkills = (user, latestResume) => {
  const skillSet = new Set(
    (user?.skills || []).map((s) => s.trim().toLowerCase()).filter(Boolean)
  );

  const extracted = latestResume?.parsedProfile?.extractedSkills;
  if (extracted && typeof extracted === 'object') {
    for (const group of Object.values(extracted)) {
      if (Array.isArray(group)) {
        for (const item of group) {
          if (typeof item === 'string' && item.trim()) {
            skillSet.add(item.trim().toLowerCase());
          }
        }
      }
    }
  }
  return skillSet;
};

export const scoreJobForUser = (
  job,
  user,
  latestResume = null,
  semanticSimilarity = null
) => {
  const candidateSkills = collectUserSkills(user, latestResume);
  const required = job.requiredSkills || [];

  const matchedSkills = [];
  const missingSkills = [];

  for (const skill of required) {
    if (candidateSkills.has(skill.toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  const skillRatio = required.length > 0 ? matchedSkills.length / required.length : 0.7;

  const userExpLevel = user?.preferences?.experienceLevel || 'Entry Level (0-2 yrs)';
  const userRank = EXP_RANK[userExpLevel] ?? 1;
  const jobRank = EXP_RANK[job.experienceLevel] ?? 1;
  const rankDiff = Math.abs(userRank - jobRank);
  const experienceFit = rankDiff === 0 ? 1 : rankDiff === 1 ? 0.7 : 0.35;

  const desiredRoles = (user?.preferences?.desiredRoles || []).map((r) => r.toLowerCase());
  const titleLower = (job.title || '').toLowerCase();
  const roleMatch = desiredRoles.some((role) => {
    const tokens = role.split(/\s+/).filter((t) => t.length > 2);
    return tokens.some((token) => titleLower.includes(token));
  })
    ? 1
    : 0.4;

  const preferredLocs = (user?.preferences?.preferredLocations || []).map((l) => l.toLowerCase());
  const locationMatch = preferredLocs.some(
    (loc) =>
      loc === (job.location || '').toLowerCase() ||
      (loc === 'remote' && job.workMode === 'Remote')
  )
    ? 1
    : 0.4;

  const hasSemantic = typeof semanticSimilarity === 'number' && semanticSimilarity > 0;
  const clampedSemantic = hasSemantic ? Math.min(1, Math.max(0, semanticSimilarity)) : 0;

  const weighted = hasSemantic
    ? 0.4 * clampedSemantic +
      0.35 * skillRatio +
      0.15 * experienceFit +
      0.05 * roleMatch +
      0.05 * locationMatch
    : 0.55 * skillRatio + 0.2 * experienceFit + 0.15 * roleMatch + 0.1 * locationMatch;

  const matchPercentage = Math.min(99, Math.max(35, Math.round(weighted * 100)));

  return {
    ...job,
    matchPercentage,
    semanticScore: hasSemantic ? Math.round(clampedSemantic * 100) : null,
    matchedSkills,
    missingSkills,
  };
};

export const getRecommendationsForUser = async (user, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 20));

  const [jobs, latestResume] = await Promise.all([
    Job.find({}).lean(),
    Resume.findOne({ userId: user._id }).sort({ uploadedAt: -1 }).lean(),
  ]);

  const combinedSkills = Array.from(collectUserSkills(user, latestResume));
  const hasCandidateContext =
    combinedSkills.length > 0 ||
    Boolean(user?.headline?.trim()) ||
    Boolean(user?.preferences?.desiredRoles?.length) ||
    Boolean(latestResume?.parsedProfile?.summary?.trim());

  let semanticScoreMap = new Map();
  let rankingMode = 'deterministic_fallback';

  if (hasCandidateContext && jobs.length > 0) {
    const semantic = await semanticSearchByCandidate({
      candidate: {
        headline: user?.headline || '',
        summary: latestResume?.parsedProfile?.summary || user?.bio || '',
        skills: combinedSkills,
        experienceLevel: user?.preferences?.experienceLevel || '',
        desiredRoles: user?.preferences?.desiredRoles || [],
        preferredLocations: user?.preferences?.preferredLocations || [],
      },
      limit: Math.min(50, Math.max(25, jobs.length)),
    });

    if (semantic.available && semantic.results.length > 0) {
      semanticScoreMap = new Map(semantic.results.map((hit) => [hit.jobId, hit.score]));
      rankingMode = 'hybrid_semantic';
    }
  }

  const ranked = jobs
    .map((job) =>
      scoreJobForUser(job, user, latestResume, semanticScoreMap.get(job._id.toString()) ?? null)
    )
    .sort((a, b) => b.matchPercentage - a.matchPercentage);

  const total = ranked.length;
  const start = (safePage - 1) * safeLimit;
  const paginated = ranked.slice(start, start + safeLimit);

  return {
    recommendations: paginated,
    rankingMode,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
};
