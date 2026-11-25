import { apiClient } from '../api/client';

export async function fetchSavedJobs() {
  const { data } = await apiClient.get('/saved-jobs');
  return data.savedJobs || [];
}

export async function saveJobById(jobId) {
  const { data } = await apiClient.post(`/saved-jobs/${jobId}`);
  return data.savedJob;
}

export async function removeSavedJobById(jobId) {
  const { data } = await apiClient.delete(`/saved-jobs/${jobId}`);
  return data;
}
