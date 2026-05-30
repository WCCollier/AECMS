'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { mutate } from 'swr';
import api, { setAccessToken, getAccessToken, getErrorMessage, getSessionId, resetSessionId } from '@/lib/api';
import type { User, AuthUser, LoginCredentials, RegisterData, AuthTokens } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch current user profile
      // Note: You may need to add this endpoint to your backend
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (credentials: LoginCredentials) => {
    try {
      // Capture anonymous session ID before logging in — needed for cart merge
      const sessionId = getSessionId();

      const response = await api.post<AuthTokens & { user: AuthUser }>('/auth/login', credentials);
      const { accessToken, refreshToken, user: userData } = response.data;

      setAccessToken(accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('refresh_token', refreshToken);
      }
      setUser(userData as unknown as User);

      // Merge anonymous cart items into the user's account cart, then refresh
      if (sessionId) {
        try {
          await api.post('/cart/merge', {}, {
            headers: { 'x-session-id': sessionId },
          });
        } catch (mergeError) {
          // Non-fatal — user cart still loads correctly even if merge fails
          console.warn('Cart merge failed:', mergeError);
        }
      }
      await mutate('/cart');
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post<{ message: string; userId: string }>('/auth/register', data);
      // Registration now requires email verification — no tokens returned
      void response;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  };

  const logout = async () => {
    try {
      const refreshToken = typeof window !== 'undefined'
        ? localStorage.getItem('refresh_token')
        : null;
      await api.post('/auth/logout', { refreshToken: refreshToken ?? '' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAccessToken(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('refresh_token');
        // Generate a fresh anonymous session so the cart starts empty after logout
        resetSessionId();
      }
      setUser(null);
      // Clear the SWR cart cache immediately — anonymous cart for the new session is empty
      await mutate('/cart', null, { revalidate: false });
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
