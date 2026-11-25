import axios from 'axios';
import { env } from '../config/env.js';

const buildHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (env.internalApiKey) {
    headers['X-Internal-API-Key'] = env.internalApiKey;
  }
  return headers;
};

export const toAiJobPayload = (job) => ({
  jobId: (job._id || job.id).toString(),
  title: job.title || '',
  company: job.company || '',
  description: job.description || '',
  requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills : [],
  experienceLevel: job.experienceLevel || '',
  location: job.location || '',
  employmentType: job.employmentType || '',
  workMode: job.workMode || '',
});

export const indexJobInQdrant = async (job) => {
  if (!env.aiServiceUrl) {
    return { indexed: false, reason: 'AI_SERVICE_URL not configured' };
  }

  try {
    const { data } = await axios.post(
      `${env.aiServiceUrl}/ai/embedding/index-job`,
      toAiJobPayload(job),
      { timeout: env.aiServiceTimeoutMs, headers: buildHeaders() }
    );
    return {
      indexed: Boolean(data?.indexed),
      pointId: data?.pointId || null,
      collection: data?.collection || null,
    };
  } catch (error) {
    return {
      indexed: false,
      reason: error.response?.data?.error?.message || error.message,
    };
  }
};

export const indexJobsBatchInQdrant = async (jobs) => {
  if (!env.aiServiceUrl) {
    return { available: false, indexedCount: 0, reason: 'AI_SERVICE_URL not configured' };
  }
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return { available: true, indexedCount: 0, pointIds: [] };
  }

  const chunkSize = 100;
  const allPointIds = [];

  try {
    for (let i = 0; i < jobs.length; i += chunkSize) {
      const chunk = jobs.slice(i, i + chunkSize).map(toAiJobPayload);
      const { data } = await axios.post(
        `${env.aiServiceUrl}/ai/embedding/index-jobs`,
        { jobs: chunk },
        { timeout: env.aiServiceTimeoutMs, headers: buildHeaders() }
      );
      if (Array.isArray(data?.pointIds)) {
        allPointIds.push(...data.pointIds);
      }
    }
    return {
      available: true,
      indexedCount: allPointIds.length,
      pointIds: allPointIds,
    };
  } catch (error) {
    return {
      available: false,
      indexedCount: allPointIds.length,
      reason: error.response?.data?.error?.message || error.message,
    };
  }
};

export const semanticSearchJobs = async ({ query, limit = 20, filters = null }) => {
  if (!env.aiServiceUrl || !query || !query.trim()) {
    return { available: false, results: [] };
  }

  try {
    const { data } = await axios.post(
      `${env.aiServiceUrl}/ai/embedding/search`,
      {
        query: query.trim(),
        limit,
        filters,
      },
      { timeout: env.aiServiceTimeoutMs, headers: buildHeaders() }
    );

    return {
      available: true,
      collection: data?.collection || null,
      results: Array.isArray(data?.results) ? data.results : [],
    };
  } catch {
    return { available: false, results: [] };
  }
};

export const semanticSearchByCandidate = async ({
  candidate,
  limit = 30,
  filters = null,
}) => {
  if (!env.aiServiceUrl || !candidate) {
    return { available: false, results: [] };
  }

  try {
    const { data } = await axios.post(
      `${env.aiServiceUrl}/ai/embedding/search-candidate`,
      {
        candidate,
        limit,
        filters,
      },
      { timeout: env.aiServiceTimeoutMs, headers: buildHeaders() }
    );

    return {
      available: true,
      collection: data?.collection || null,
      results: Array.isArray(data?.results) ? data.results : [],
    };
  } catch {
    return { available: false, results: [] };
  }
};
