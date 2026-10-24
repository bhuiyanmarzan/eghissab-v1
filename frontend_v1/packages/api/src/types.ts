export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ApiResponseError {
  error: ApiErrorDetail;
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  role?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface AuthTokens {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  user: UserProfile;
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
