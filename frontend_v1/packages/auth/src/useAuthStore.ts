import { create } from 'zustand';
import { configureApiAuth, refreshSession, type UserProfile } from '@eghissab/api';

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

configureApiAuth({
  getToken: () => useAuthStore.getState().accessToken,
  onRefresh: async () => {
    const res = await refreshSession();
    useAuthStore.getState().setAccessToken(res.access_token);
    return res.access_token;
  },
  onAuthFailure: () => {
    useAuthStore.getState().clearAuth();
  },
});
