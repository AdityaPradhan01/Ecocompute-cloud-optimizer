import axios from 'axios';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'ecocompute_token';

// sessionStorage, not localStorage — a token here dies with the browser
// session (closing the last tab/window), not twelve hours later whenever
// the token's own expiry happens to land. localStorage persisting across
// full browser restarts is exactly what made "Open the product" skip
// straight past login days after someone last typed a password: the
// session was still technically valid, just invisible and forgotten.
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

// Decodes the JWT payload to check `exp` client-side, without a library —
// this is NOT a security boundary (the backend independently verifies the
// signature on every request regardless), it's just so the UI doesn't
// treat a token that's already expired as "logged in" for even one
// render before an API call fails and bounces to /login.
export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true; // malformed token — treat as expired/invalid
  }
}

const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default client;
