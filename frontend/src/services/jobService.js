import { apiClient, getAuthToken } from '../api/client';

const EXP_RANK = {
  'Student / Intern': 0,
  'Entry Level (0-2 yrs)': 1,
  'Mid Level (2-5 yrs)': 2,
  'Senior (5+ yrs)': 3,
};

export function normalizeBackendJob(job) {
  return {
    id: job._id || job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    workMode: job.workMode || 'Hybrid',
    jobType: job.employmentType || job.jobType || 'Full-time',
    experienceLevel: job.experienceLevel || 'Entry Level (0-2 yrs)',
    salaryRange: job.salaryRange || 'Competitive',
    postedAgo: job.createdAt
      ? new Date(job.createdAt).toLocaleDateString()
      : job.postedAgo || 'Recently posted',
    requiredSkills: job.requiredSkills || [],
    niceToHaveSkills: job.niceToHaveSkills || [],
    description: job.description || '',
    responsibilities: job.responsibilities || [],
    matchPercentage: job.matchPercentage ?? null,
    semanticScore: job.semanticScore ?? null,
    matchedSkills: job.matchedSkills || [],
    missingSkills: job.missingSkills || [],
  };
}

/**
 * Compute deterministic match score when viewing unranked job search hits.
 */
export function computeJobMatch(job, candidateProfile) {
  const candidateSkills = new Set(
    (candidateProfile?.skills || []).map((skill) => skill.trim().toLowerCase())
  );

  const matchedSkills = [];
  const missingSkills = [];

  for (const reqSkill of job.requiredSkills || []) {
    if (candidateSkills.has(reqSkill.toLowerCase())) {
      matchedSkills.push(reqSkill);
    } else {
      missingSkills.push(reqSkill);
    }
  }

  const skillRatio =
    job.requiredSkills?.length > 0 ? matchedSkills.length / job.requiredSkills.length : 0.7;

  const candidateRank = EXP_RANK[candidateProfile?.experienceLevel] ?? 1;
  const jobRank = EXP_RANK[job.experienceLevel] ?? 1;
  const rankDiff = Math.abs(candidateRank - jobRank);
  const experienceFit = rankDiff === 0 ? 1 : rankDiff === 1 ? 0.7 : 0.35;

  const semanticFactor =
    typeof job.semanticScore === 'number' ? job.semanticScore / 100 : 0.7;

  const rawScore = 0.35 * semanticFactor + 0.5 * skillRatio + 0.15 * experienceFit;
  const matchPercentage = Math.min(99, Math.max(35, Math.round(rawScore * 100)));

  return {
    ...job,
    matchPercentage,
    matchedSkills,
    missingSkills,
  };
}

/**
 * Fetch personalized recommendations from backend (or public jobs catalog).
 */
export async function getRankedJobs(candidateProfile) {
  if (getAuthToken()) {
    const { data } = await apiClient.get('/recommendations', {
      params: { limit: 50 },
    });
    const list = Array.isArray(data?.recommendations) ? data.recommendations : [];
    return {
      jobs: list.map(normalizeBackendJob),
      rankingMode: data?.rankingMode || 'deterministic_fallback',
    };
  }

  const { data } = await apiClient.get('/jobs', { params: { limit: 50 } });
  const list = Array.isArray(data?.jobs) ? data.jobs : [];
  return {
    jobs: list
      .map((job) => computeJobMatch(normalizeBackendJob(job), candidateProfile))
      .sort((a, b) => b.matchPercentage - a.matchPercentage),
    rankingMode: 'deterministic_fallback',
  };
}

/**
 * Search jobs via backend /api/jobs/search (uses Qdrant semantic search when available).
 */
export async function searchJobsRemote(filters, candidateProfile) {
  const { data } = await apiClient.get('/jobs/search', {
    params: {
      q: filters.search?.trim() || undefined,
      location: filters.location !== 'All' ? filters.location : undefined,
      experienceLevel: filters.experience !== 'All' ? filters.experience : undefined,
      skill: filters.skill !== 'All' ? filters.skill : undefined,
      employmentType: ['Full-time', 'Part-time', 'Contract', 'Internship'].includes(
        filters.jobType
      )
        ? filters.jobType
        : undefined,
      workMode: ['Remote', 'Hybrid', 'Onsite'].includes(filters.jobType)
        ? filters.jobType
        : undefined,
      limit: 50,
    },
  });

  const list = Array.isArray(data?.jobs) ? data.jobs : [];
  return {
    jobs: list.map((job) => computeJobMatch(normalizeBackendJob(job), candidateProfile)),
    searchMode: data?.searchMode || 'keyword_fallback',
  };
}

/**
 * Filter ranked jobs locally in Job Explorer.
 */
export function filterJobs(jobs, filters) {
  const { search = '', location = 'All', experience = 'All', skill = 'All', jobType = 'All' } =
    filters;
  const q = search.trim().toLowerCase();

  return jobs.filter((job) => {
    if (q) {
      const haystack = `${job.title} ${job.company} ${job.description} ${(job.requiredSkills || []).join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (location !== 'All') {
      const matchesLoc =
        job.location.toLowerCase() === location.toLowerCase() ||
        (location === 'Remote' && job.workMode === 'Remote');
      if (!matchesLoc) return false;
    }

    if (experience !== 'All' && job.experienceLevel !== experience) {
      return false;
    }

    if (skill !== 'All') {
      const allSkills = [...(job.requiredSkills || []), ...(job.niceToHaveSkills || [])].map(
        (s) => s.toLowerCase()
      );
      if (!allSkills.includes(skill.toLowerCase())) return false;
    }

    if (jobType !== 'All') {
      const matchesType = job.jobType === jobType || job.workMode === jobType;
      if (!matchesType) return false;
    }

    return true;
  });
}
