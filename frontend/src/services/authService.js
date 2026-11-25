import { apiClient, setAuthToken } from '../api/client';

export async function registerUser({ name, email, password }) {
  const { data } = await apiClient.post('/auth/register', { name, email, password });
  if (!data?.token || !data?.user) {
    throw new Error('Authentication server returned an invalid registration response.');
  }
  setAuthToken(data.token);
  return data;
}

export async function loginUser({ email, password }) {
  const { data } = await apiClient.post('/auth/login', { email, password });
  if (!data?.token || !data?.user) {
    throw new Error('Authentication server returned an invalid login response.');
  }
  setAuthToken(data.token);
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get('/auth/me');
  if (!data?.user) {
    throw new Error('Failed to load authenticated user.');
  }
  return data.user;
}

export function logoutUser() {
  setAuthToken(null);
}
