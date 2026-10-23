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
  user: UserProfile;
}
