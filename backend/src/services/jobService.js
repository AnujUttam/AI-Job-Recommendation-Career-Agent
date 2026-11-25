import { Job } from '../models/Job.js';
import { ApiError } from '../utils/ApiError.js';
import {
  indexJobInQdrant,
  indexJobsBatchInQdrant,
  semanticSearchJobs,
} from './aiVectorService.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildJobFilter = ({
  q,
  search,
  location,
  experienceLevel,
  skill,
  employmentType,
  workMode,
}) => {
  const filter = {};
  const searchTerm = (q || search || '').trim();

  if (searchTerm) {
    const regex = new RegExp(escapeRegex(searchTerm), 'i');
    filter.$or = [
      { title: regex },
      { company: regex },
      { description: regex },
      { requiredSkills: regex },
    ];
  }

  if (location && location !== 'All') {
    if (location.toLowerCase() === 'remote') {
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ location: /remote/i }, { workMode: 'Remote' }] },
      ];
    } else {
      filter.location = new RegExp(`^${escapeRegex(location)}$`, 'i');
    }
  }

  if (experienceLevel && experienceLevel !== 'All') {
    filter.experienceLevel = experienceLevel;
  }

  if (employmentType && employmentType !== 'All') {
    filter.employmentType = employmentType;
  }

  if (workMode && workMode !== 'All') {
    filter.workMode = workMode;
  }

  if (skill && skill !== 'All') {
    const skillRegex = new RegExp(`^${escapeRegex(skill)}$`, 'i');
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ requiredSkills: skillRegex }, { niceToHaveSkills: skillRegex }] },
    ];
  }

  return filter;
};

const buildQdrantFilters = ({
  location,
  experienceLevel,
  skill,
  employmentType,
  workMode,
}) => {
  const filters = {};
  if (location && location !== 'All') filters.location = location;
  if (experienceLevel && experienceLevel !== 'All') filters.experienceLevel = experienceLevel;
  if (employmentType && employmentType !== 'All') filters.employmentType = employmentType;
  if (workMode && workMode !== 'All') filters.workMode = workMode;
  if (skill && skill !== 'All') filters.requiredSkills = [skill];
  return Object.keys(filters).length > 0 ? filters : null;
};

export const listJobs = async (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = buildJobFilter(query);

  const [jobs, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(filter),
  ]);

  return {
    jobs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const searchJobs = async (query = {}) => {
  const searchTerm = (query.q || query.search || '').trim();
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));

  if (searchTerm && query.mode !== 'keyword') {
    const qdrantFilters = buildQdrantFilters(query);
    const semantic = await semanticSearchJobs({
      query: searchTerm,
      limit: Math.min(50, page * limit),
      filters: qdrantFilters,
    });

    if (semantic.available && semantic.results.length > 0) {
      const hitIds = semantic.results.map((hit) => hit.jobId).filter(Boolean);
      const scoreById = new Map(
        semantic.results.map((hit) => [hit.jobId, Math.round(hit.score * 100)])
      );

      const docs = await Job.find({ _id: { $in: hitIds } }).lean();
      const docById = new Map(docs.map((doc) => [doc._id.toString(), doc]));

      const ordered = hitIds
        .map((id) => {
          const doc = docById.get(id);
          if (!doc) return null;
          return {
            ...doc,
            semanticScore: scoreById.get(id) ?? null,
          };
        })
        .filter(Boolean);

      if (ordered.length > 0) {
        const start = (page - 1) * limit;
        return {
          jobs: ordered.slice(start, start + limit),
          searchMode: 'semantic',
          pagination: {
            total: ordered.length,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(ordered.length / limit)),
          },
        };
      }
    }
  }

  const keywordResult = await listJobs(query);
  return {
    ...keywordResult,
    searchMode: 'keyword_fallback',
  };
};

export const getJobById = async (jobId) => {
  const job = await Job.findById(jobId).lean();
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }
  return job;
};

export const createJob = async (jobPayload) => {
  const job = await Job.create(jobPayload);
  const jobObj = job.toObject();
  const vectorResult = await indexJobInQdrant(jobObj);

  return {
    ...jobObj,
    vectorIndexed: vectorResult.indexed,
  };
};

export const syncAllJobsToQdrant = async () => {
  const jobs = await Job.find({}).lean();
  const result = await indexJobsBatchInQdrant(jobs);
  return {
    totalJobs: jobs.length,
    ...result,
  };
};
