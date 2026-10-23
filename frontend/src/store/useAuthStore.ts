import { create } from 'zustand';

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
}

export interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: UserProfile, token: string) => void;
  setAccessToken: (token: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  setInitialized: (initialized: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  setAuth: (user, token) =>
    set({
      user,
      accessToken: token,
      isAuthenticated: true,
      isInitialized: true,
    }),
  setAccessToken: (token) =>
    set((state) => ({
      accessToken: token,
      isAuthenticated: !!token || !!state.user,
    })),
  setUser: (user) =>
    set((state) => ({
      user,
      isAuthenticated: !!user || !!state.accessToken,
    })),
  setInitialized: (initialized) =>
    set({
      isInitialized: initialized,
    }),
  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isInitialized: true,
    }),
}));
