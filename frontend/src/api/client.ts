import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Request interceptor to attach Bearer token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track refresh in flight to queue concurrent 401s
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

import { refreshSession } from './auth';

// Response interceptor for automatic 401 token refresh
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

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
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
        const data = await refreshSession();
        const newAccessToken = data.access_token;
        useAuthStore.getState().setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export type Stat = { id: string; label: string; value: string; change: number; color: string };
export type Order = { id: string; product: string; quantity: number; status: 'Approved' | 'Pending' | 'Rejected'; amount: number };
export type Customer = { id: string; name: string; email: string; phone: string; age: number; country: string; status: 'Complete' | 'Pending' | 'Canceled' };
export type Product = { id: string; name: string; category: string; price: number; stock: number; rating: number };

export async function getStats() { return (await api.get<Stat[]>('/stats')).data; }
export async function getOrders() { return (await api.get<Order[]>('/orders')).data; }
export async function getCustomers() { return (await api.get<Customer[]>('/customers')).data; }
export async function getProducts() { return (await api.get<Product[]>('/products')).data; }
