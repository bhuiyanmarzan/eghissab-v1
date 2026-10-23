import { api } from './client';
import type { UserProfile } from '../store/useAuthStore';

export interface RegisterRequest {
  email: string;
  first_name: string;
  last_name?: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface MessageResponse {
  message: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

export async function registerUser(req: RegisterRequest): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>('/auth/register', req);
  return data;
}

export async function loginUser(req: LoginRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', req);
  return data;
}

export async function verifyEmail(req: VerifyEmailRequest): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>('/auth/verify-email', req);
  return data;
}

export async function resendVerification(req: ResendVerificationRequest): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>('/auth/resend-verification', req);
  return data;
}

let inFlightRefresh: Promise<AuthResponse> | null = null;

export async function refreshSession(refreshToken?: string): Promise<AuthResponse> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  const payload = refreshToken ? { refresh_token: refreshToken } : undefined;
  inFlightRefresh = api
    .post<AuthResponse>('/auth/refresh', payload)
    .then((res) => res.data)
    .finally(() => {
      inFlightRefresh = null;
    });
  return inFlightRefresh;
}

export async function getCurrentUser(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/auth/me');
  return data;
}

export async function logoutUser(): Promise<void> {
  await api.post('/auth/logout');
}

export async function logoutAllDevices(): Promise<void> {
  await api.post('/auth/logout-all');
}
