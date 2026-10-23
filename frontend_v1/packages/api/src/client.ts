import axios, { type InternalAxiosRequestConfig } from 'axios';

type TokenGetter = () => string | null;
type RefreshHandler = () => Promise<string | null>;
type AuthFailureHandler = () => void;

let tokenGetter: TokenGetter = () => null;
let refreshHandler: RefreshHandler | null = null;
let authFailureHandler: AuthFailureHandler = () => {};

export function configureApiAuth(options: {
  getToken: TokenGetter;
  onRefresh?: RefreshHandler;
  onAuthFailure?: AuthFailureHandler;
}) {
  tokenGetter = options.getToken;
  if (options.onRefresh) refreshHandler = options.onRefresh;
  if (options.onAuthFailure) authFailureHandler = options.onAuthFailure;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenGetter();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint && refreshHandler) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await refreshHandler();
        processQueue(null, newAccessToken);
        if (originalRequest.headers && newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        authFailureHandler();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export { isAxiosError } from 'axios';

export function getApiError(err: unknown) {
  if (axios.isAxiosError(err) && err.response?.data) {
    const data = err.response.data as { error?: import('./types').ApiErrorDetail };
    return data.error || null;
  }
  return null;
}
