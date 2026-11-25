import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const AUTH_TOKEN_KEY = 'careerai_token';

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = (token) => {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isAuthAttempt =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    if (status === 401 && !isAuthAttempt) {
      setAuthToken(null);
      if (typeof unauthorizedHandler === 'function') {
        unauthorizedHandler();
      }
    }

    const details = error.response?.data?.details;
    const detailText =
      Array.isArray(details) && details.length > 0
        ? details.map((d) => d.message).join(' ')
        : '';
    const message =
      detailText ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';

    const enrichedError = new Error(message);
    enrichedError.status = status;
    enrichedError.details = details;
    return Promise.reject(enrichedError);
  }
);
