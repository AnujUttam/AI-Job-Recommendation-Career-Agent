import { Job } from '../models/Job.js';
import { Resume } from '../models/Resume.js';
import { ApiError } from '../utils/ApiError.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const collectActualCandidateSkills = (user, latestResume) => {
  const seen = new Map();

  const addSkill = (raw) => {
    if (typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, trimmed);
    }
  };

  for (const s of user?.skills || []) {
    addSkill(s);
  }

  const extracted = latestResume?.parsedProfile?.extractedSkills;
  if (extracted && typeof extracted === 'object') {
    for (const group of Object.values(extracted)) {
      if (Array.isArray(group)) {
        for (const s of group) {
          addSkill(s);
        }
      }
    }
  }

  return seen;
};

export const analyzeSkillGapForUser = async (user, { jobId = null, targetRole = '' } = {}) => {
  const latestResume = await Resume.findOne({ userId: user._id })
    .sort({ uploadedAt: -1 })
    .lean();

  const candidateSkillMap = collectActualCandidateSkills(user, latestResume);
  const candidateSkills = Array.from(candidateSkillMap.values());

  let targetJobs = [];
  let scopeLabel = '';

  if (jobId) {
    const job = await Job.findById(jobId).lean();
    if (!job) {
      throw new ApiError(404, 'Target job not found.');
    }
    targetJobs = [job];
    scopeLabel = `${job.title} at ${job.company}`;
  } else if (targetRole && targetRole.trim()) {
    const cleanedRole = targetRole.trim();
    const regex = new RegExp(escapeRegex(cleanedRole), 'i');
    targetJobs = await Job.find({
      $or: [{ title: regex }, { description: regex }],
    })
      .limit(8)
      .lean();
    scopeLabel = cleanedRole;
  } else {
    const desiredRoles = user?.preferences?.desiredRoles || [];
    if (desiredRoles.length > 0) {
      const roleRegexes = desiredRoles.map((r) => new RegExp(escapeRegex(r.trim()), 'i'));
      targetJobs = await Job.find({ title: { $in: roleRegexes } })
        .limit(8)
        .lean();
      scopeLabel = desiredRoles[0];
    }
    if (targetJobs.length === 0) {
      targetJobs = await Job.find({}).limit(8).lean();
      scopeLabel = scopeLabel || 'Indexed Technology Roles';
    }
  }

  if (targetJobs.length === 0) {
    return {
      scopeLabel: scopeLabel || 'Target Role',
      targetJobsCount: 0,
      candidateSkills,
      matchedSkills: [],
      missingSkills: [],
      niceToHaveGaps: [],
      skillMatchPercentage: 0,
      formulaExplanation: 'No matching jobs found in the database to compute skill match.',
      learningPriorities: [],
      jobBreakdowns: [],
      verifiedRequirements: [],
    };
  }

  const requiredMap = new Map();
  const requiredFreq = new Map();
  const niceToHaveMap = new Map();

  for (const job of targetJobs) {
    const jobReqs = new Set();
    for (const s of job.requiredSkills || []) {
      const trimmed = (s || '').trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!requiredMap.has(key)) requiredMap.set(key, trimmed);
      if (!jobReqs.has(key)) {
        jobReqs.add(key);
        requiredFreq.set(key, (requiredFreq.get(key) || 0) + 1);
      }
    }
    for (const s of job.niceToHaveSkills || []) {
      const trimmed = (s || '').trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!niceToHaveMap.has(key)) niceToHaveMap.set(key, trimmed);
    }
  }

  const matchedSkills = [];
  const missingEntries = [];

  for (const [key, display] of requiredMap.entries()) {
    if (candidateSkillMap.has(key)) {
      matchedSkills.push(display);
    } else {
      missingEntries.push({
        key,
        skill: display,
        frequency: requiredFreq.get(key) || 1,
      });
    }
  }

  missingEntries.sort((a, b) => b.frequency - a.frequency || a.skill.localeCompare(b.skill));
  const missingSkills = missingEntries.map((item) => item.skill);

  const niceToHaveGaps = Array.from(niceToHaveMap.entries())
    .filter(([key]) => !candidateSkillMap.has(key) && !requiredMap.has(key))
    .map(([, display]) => display);

  const totalRequired = requiredMap.size;
  const skillMatchPercentage =
    totalRequired > 0 ? Math.round((matchedSkills.length / totalRequired) * 100) : 100;

  const learningPriorities = missingEntries.map((item, idx) => ({
    rank: idx + 1,
    skill: item.skill,
    jobsRequiring: item.frequency,
    totalTargetJobs: targetJobs.length,
    priority:
      item.frequency >= Math.max(2, Math.ceil(targetJobs.length / 2)) || idx < 2
        ? 'High'
        : 'Medium',
  }));

  const jobBreakdowns = targetJobs.map((job) => {
    const reqs = (job.requiredSkills || []).map((s) => s.trim()).filter(Boolean);
    const jobMatched = reqs.filter((s) => candidateSkillMap.has(s.toLowerCase()));
    const jobMissing = reqs.filter((s) => !candidateSkillMap.has(s.toLowerCase()));
    return {
      jobId: job._id.toString(),
      title: job.title,
      company: job.company,
      location: job.location,
      workMode: job.workMode,
      matchPercentage: reqs.length > 0 ? Math.round((jobMatched.length / reqs.length) * 100) : 100,
      matchedSkills: jobMatched,
      missingSkills: jobMissing,
    };
  });

  return {
    scopeLabel,
    targetJobsCount: targetJobs.length,
    candidateSkills,
    matchedSkills,
    missingSkills,
    niceToHaveGaps,
    skillMatchPercentage,
    formulaExplanation: `${matchedSkills.length} of ${totalRequired} unique required skills matched across ${targetJobs.length} ${
      targetJobs.length === 1 ? 'job' : 'jobs'
    } (${skillMatchPercentage}%).`,
    learningPriorities,
    jobBreakdowns,
    verifiedRequirements: Array.from(requiredMap.values()),
  };
};

export const generateCareerRoadmapForUser = async (
  user,
  { jobId = null, targetRole = '' } = {}
) => {
  const gapAnalysis = await analyzeSkillGapForUser(user, { jobId, targetRole });
  const skillsToLearn = gapAnalysis.missingSkills.slice(0, 6);
  const careerGoal = gapAnalysis.scopeLabel || targetRole || 'Target Engineering Role';
  const experienceLevel = user?.preferences?.experienceLevel || 'Entry Level (0-2 yrs)';

  let stages = [];
  let estimatedTimeline = '4 Weeks';

  if (skillsToLearn.length === 0) {
    stages = [
      {
        stage: 1,
        title: 'Resume & Impact Quantification',
        timeline: 'Week 1',
        skillsToLearn: [],
        suggestedProjects: [
          `Audit and refine your top 2 project READMEs to highlight ${careerGoal} architecture.`,
        ],
        milestones: [
          'Quantify latency, accuracy, or scale metrics on your key experience bullets.',
        ],
      },
      {
        stage: 2,
        title: 'Testing & Production Reliability',
        timeline: 'Week 2',
        skillsToLearn: gapAnalysis.niceToHaveGaps.slice(0, 2),
        suggestedProjects: [
          'Add automated integration tests and error-handling coverage to a flagship repository.',
        ],
        milestones: ['Achieve clean test execution with documented setup instructions.'],
      },
      {
        stage: 3,
        title: 'System Design & Retrieval Practice',
        timeline: 'Week 3',
        skillsToLearn: [],
        suggestedProjects: [
          'Write a short design note explaining database indexing, caching, and API contracts.',
        ],
        milestones: ['Complete 3 system-design walkthroughs tailored to your target level.'],
      },
      {
        stage: 4,
        title: 'Targeted Applications & Mock Interviews',
        timeline: 'Week 4',
        skillsToLearn: [],
        suggestedProjects: [
          `Prepare concise 3-minute project demos aligned with ${careerGoal}.`,
        ],
        milestones: [
          `Apply to your top matched roles (${experienceLevel}).`,
          'Complete 2 timed technical and behavioral mock interviews.',
        ],
      },
    ];
  } else {
    const primary = skillsToLearn[0];
    const secondary = skillsToLearn[1] || primary;
    const tertiary = skillsToLearn[2] || secondary;
    estimatedTimeline = skillsToLearn.length <= 3 ? '4 Weeks' : '6 Weeks';

    stages = [
      {
        stage: 1,
        title: `Core Foundations: ${primary}`,
        timeline: 'Week 1',
        skillsToLearn: [primary],
        suggestedProjects: [
          `Build a focused standalone module or API endpoint using ${primary}.`,
        ],
        milestones: [
          `Complete core documentation and build 1 working prototype with ${primary}.`,
        ],
      },
      {
        stage: 2,
        title: `Applied Engineering: ${secondary}`,
        timeline: 'Week 2',
        skillsToLearn: secondary !== primary ? [secondary] : [primary],
        suggestedProjects: [
          `Integrate ${secondary} with input validation, error handling, and unit tests.`,
        ],
        milestones: [
          `Push tested ${secondary} implementation to GitHub with setup notes.`,
        ],
      },
      {
        stage: 3,
        title: `End-to-End Integration: ${tertiary}`,
        timeline: estimatedTimeline === '4 Weeks' ? 'Week 3' : 'Weeks 3-4',
        skillsToLearn: skillsToLearn.slice(2, 4).length > 0 ? skillsToLearn.slice(2, 4) : [tertiary],
        suggestedProjects: [
          `Combine ${primary}, ${secondary}, and ${tertiary} into a cohesive portfolio feature for ${careerGoal}.`,
        ],
        milestones: [
          'Update your CareerAI profile and resume with your newly verified project work.',
        ],
      },
      {
        stage: 4,
        title: 'Interview Readiness & Role Alignment',
        timeline: estimatedTimeline === '4 Weeks' ? 'Week 4' : 'Weeks 5-6',
        skillsToLearn: skillsToLearn.slice(4, 6),
        suggestedProjects: [
          `Prepare architecture walkthroughs comparing trade-offs for ${careerGoal}.`,
        ],
        milestones: [
          'Re-run Skill Gap Analysis to confirm improved match coverage.',
          'Submit tailored applications to your highest-fit listings.',
        ],
      },
    ];
  }

  return {
    careerGoal,
    experienceLevel,
    estimatedTimeline,
    skillsToLearn,
    assumptions: [
      'Assumes 10-12 hours per week of focused study and hands-on coding.',
      'Timeline scales based on the number of missing required skills detected.',
      'Roadmap stages, projects, and milestones are generated via deterministic templates (template mode) rather than a live LLM.',
    ],
    verifiedMarketRequirements: gapAnalysis.verifiedRequirements,
    generatedSuggestions: {
      isTemplateGenerated: true,
      stages,
    },
    gapSummary: {
      skillMatchPercentage: gapAnalysis.skillMatchPercentage,
      matchedCount: gapAnalysis.matchedSkills.length,
      missingCount: gapAnalysis.missingSkills.length,
      targetJobsCount: gapAnalysis.targetJobsCount,
    },
  };
};
