import { apiClient } from '../api/client';

export async function fetchSkillGapAnalysis({ jobId, targetRole } = {}) {
  const payload = {};
  if (jobId) payload.jobId = jobId;
  if (targetRole && targetRole.trim()) payload.targetRole = targetRole.trim();

  const { data } = await apiClient.post('/career/skill-gap', payload);
  return data.analysis;
}

export async function fetchCareerRoadmap({ jobId, targetRole } = {}) {
  const payload = {};
  if (jobId) payload.jobId = jobId;
  if (targetRole && targetRole.trim()) payload.targetRole = targetRole.trim();

  const { data } = await apiClient.post('/career/roadmap', payload);
  return data.roadmap;
}
