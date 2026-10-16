function resolveApiBaseUrl() {
  let envUrl = '';
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      envUrl =
        import.meta.env.VITE_API_URL ||
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.REACT_APP_API_URL ||
        '';
    }
  } catch {}

  try {
    if (!envUrl && typeof process !== 'undefined' && process.env) {
      envUrl =
        process.env.REACT_APP_API_URL ||
        process.env.VITE_API_URL ||
        process.env.VITE_BACKEND_URL ||
        '';
    }
  } catch {}

  const trimmed = String(envUrl || '').trim();
  if (trimmed) {
    return trimmed.replace(/\/+$/, '');
  }

  // Fallback cho local development
  return 'http://localhost:4000';
}

export const API_BASE_URL = resolveApiBaseUrl();
export const API_URL = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;

const TOKEN_KEY = 'authToken';

export const tokenStore = {
  get: () => (typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null),
  set: (token) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  },
  clear: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  },
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
 * Bọc try...catch xử lý triệt để lỗi mạng Failed to fetch và timeout.
 */
export async function request(path, { method = 'GET', body, headers = {}, signal } = {}) {
  const token = tokenStore.get();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const finalHeaders = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = `${API_URL}${cleanPath}`;

  let response;
  try {
    let timeoutId;
    let activeSignal = signal;

    // Timeout 30s để tránh nút bấm xoay vòng vô tận nếu server chết / khởi động lại.
    // Trong môi trường test Vitest/JSDOM, tránh truyền signal giả của jsdom vào undici/fetch nếu chưa được caller chỉ định rõ.
    const isTestEnv = typeof process !== 'undefined' && (process.env?.VITEST || process.env?.NODE_ENV === 'test');
    if (!activeSignal && !isTestEnv && typeof AbortController !== 'undefined') {
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => {
          try { controller.abort(); } catch {}
        }, 30000);
        activeSignal = controller.signal;
      } catch {}
    }

    try {
      response = await fetch(targetUrl, {
        method,
        headers: finalHeaders,
        body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
        ...(activeSignal ? { signal: activeSignal } : {}),
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch (networkError) {
    console.error(`[API Network Error] ${method} ${targetUrl}:`, networkError);

    let friendlyMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.';
    if (networkError.name === 'AbortError') {
      friendlyMessage = 'Yêu cầu kết nối quá thời gian chờ (30 giây). Máy chủ đang phản hồi chậm hoặc đang khởi động lại (Cold Start). Vui lòng thử lại!';
    } else if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      targetUrl.startsWith('http://')
    ) {
      friendlyMessage = 'Lỗi kết nối (Mixed Content): Ứng dụng chạy trên HTTPS nhưng API URL là HTTP. Vui lòng cấu hình VITE_API_URL với URL HTTPS của backend trên Vercel!';
    } else if (networkError.message === 'Failed to fetch') {
      friendlyMessage = 'Không thể kết nối tới máy chủ (Failed to fetch). Vui lòng kiểm tra cấu hình biến VITE_API_URL trên Vercel!';
    } else if (networkError.message) {
      friendlyMessage = networkError.message;
    }

    throw new ApiError(0, 'NETWORK_ERROR', friendlyMessage, { originalError: networkError });
  }

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
