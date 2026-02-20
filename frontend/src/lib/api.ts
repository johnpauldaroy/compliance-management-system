import axios from 'axios';

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const normalizeApiBaseUrl = (rawUrl?: string) => {
  const fallback = 'http://localhost:8001/api';
  const candidate = trimTrailingSlashes((rawUrl || fallback).trim());

  if (/\/api$/i.test(candidate)) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.pathname === '' || parsed.pathname === '/') {
      return `${candidate}/api`;
    }
  } catch {
    // Keep the original value if URL parsing fails.
  }

  return candidate;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
export const API_ROOT_URL = API_BASE_URL.replace(/\/api$/i, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

export default api;
