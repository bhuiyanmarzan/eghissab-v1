import { api } from './client';
import type {
  RegisterRequest,
  LoginRequest,
  VerifyEmailRequest,
  AuthResponse,
  UserProfile,
  IdentityLinkingRequiredResponse,
  GoogleLoginRequest,
  GoogleLinkConfirmRequest,
  ContactItem,
  LinkedIdentityItem,
} from './types';

export interface MessageResponse {
  message: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export async function registerUser(req: RegisterRequest): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>('/auth/register', req);
  return data;
}

export async function loginUser(req: LoginRequest): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', req);
  return data;
}

export async function verifyEmail(req: { token: string }): Promise<MessageResponse> {
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

export async function getGoogleAuthUrl(): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>('/auth/google/url');
  return data;
}

export async function loginWithGoogle(
  req: GoogleLoginRequest
): Promise<AuthResponse | IdentityLinkingRequiredResponse> {
  const { data } = await api.post<AuthResponse | IdentityLinkingRequiredResponse>(
    '/auth/google/login',
    req
  );
  return data;
}

export async function confirmGoogleLink(
  req: GoogleLinkConfirmRequest
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/google/link/confirm', req);
  return data;
}

export async function getUserContacts(): Promise<ContactItem[]> {
  const { data } = await api.get<ContactItem[]>('/auth/contacts');
  return data;
}

export async function addContact(
  type: 'email' | 'phone',
  value: string
): Promise<{ id: string; message: string }> {
  const { data } = await api.post<{ id: string; message: string }>('/auth/contacts', {
    type,
    value,
  });
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
