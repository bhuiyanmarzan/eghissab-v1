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

export interface IdentityLinkingRequiredResponse {
  status: 'linking_required';
  link_challenge_token: string;
  email: string;
  message: string;
}

export interface GoogleLoginRequest {
  code: string;
  state: string;
}

export interface GoogleLinkConfirmRequest {
  link_challenge_token: string;
  password?: string;
  code?: string;
}

export interface ContactItem {
  id: string;
  type: 'email' | 'phone';
  value: string;
  is_primary: boolean;
  verified: boolean;
  created_at: string;
}

export interface LinkedIdentityItem {
  id: string;
  provider: string;
  status: string;
  created_at: string;
}

export interface ConsumerProfile {
  id: string;
  user_id: string;
  status: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getGoogleAuthUrl(): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>('/auth/google/url');
  return data;
}

export async function loginWithGoogle(req: GoogleLoginRequest): Promise<AuthResponse | IdentityLinkingRequiredResponse> {
  const { data } = await api.post<AuthResponse | IdentityLinkingRequiredResponse>('/auth/google/login', req);
  return data;
}

export async function confirmGoogleLink(req: GoogleLinkConfirmRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/google/link/confirm', req);
  return data;
}

export async function getUserContacts(): Promise<ContactItem[]> {
  const { data } = await api.get<ContactItem[]>('/auth/contacts');
  return data;
}

export async function addContact(type: 'email' | 'phone', value: string): Promise<{ id: string; message: string }> {
  const { data } = await api.post<{ id: string; message: string }>('/auth/contacts', { type, value });
  return data;
}

export async function verifyContact(token: string): Promise<{ status: string }> {
  const { data } = await api.post<{ status: string }>('/auth/contacts/verify', { token });
  return data;
}

export async function setPrimaryContact(contactId: string): Promise<{ status: string }> {
  const { data } = await api.put<{ status: string }>(`/auth/contacts/${contactId}/primary`);
  return data;
}

export async function deleteContact(contactId: string): Promise<void> {
  await api.delete(`/auth/contacts/${contactId}`);
}

export async function getLinkedIdentities(): Promise<LinkedIdentityItem[]> {
  const { data } = await api.get<LinkedIdentityItem[]>('/auth/identities');
  return data;
}

export async function getConsumerProfile(): Promise<ConsumerProfile> {
  const { data } = await api.get<ConsumerProfile>('/consumer/profile');
  return data;
}

export async function createConsumerProfile(preferences: Record<string, unknown> = {}): Promise<ConsumerProfile> {
  const { data } = await api.post<ConsumerProfile>('/consumer/profile', { preferences });
  return data;
}

export async function updateConsumerPreferences(preferences: Record<string, unknown>): Promise<ConsumerProfile> {
  const { data } = await api.patch<ConsumerProfile>('/consumer/profile', { preferences });
  return data;
}

