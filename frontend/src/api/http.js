const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const API_URL = `${API_BASE_URL}/api`;

const TOKEN_KEY = 'authToken';

export const tokenStore = {
  get: () => (typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null),
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

/**
 * Global hooks the AuthProvider subscribes to. Kept module-level so any layer
 * (even outside React) can react to auth transitions without prop drilling.
 */
const listeners = { onUnauthorized: null, onLocked: null };
export function setAuthListeners({ onUnauthorized, onLocked }) {
  listeners.onUnauthorized = onUnauthorized;
  listeners.onLocked = onLocked;
}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseError(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const err = body?.error || {};
  return new ApiError(
    response.status,
    err.code || `HTTP_${response.status}`,
    err.message || response.statusText || 'Đã xảy ra lỗi',
    err.details
  );
}

/**
 * Core fetch wrapper. Attaches the Bearer token, parses the shared error
 * envelope, and dispatches 401 (logout) / 423 (locked) to global listeners.
 * Supports both JSON bodies and FormData (multipart) uploads.
 */
export async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const token = tokenStore.get();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const finalHeaders = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const error = await parseError(response);
    if (error.status === 401) listeners.onUnauthorized?.(error);
    if (error.status === 423) listeners.onLocked?.(error);
    throw error;
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const http = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

export default http;
