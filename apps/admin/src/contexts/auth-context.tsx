import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthTokenAccessors } from '../lib/api-client';
import { authService } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: (accessToken: string, refreshToken: string, user: User, onComplete?: () => void) => void;
  logout: () => void;
  updateAccessToken: (newAccessToken: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Store access token in memory only (cleared on page reload)
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const navigate = useNavigate();

  // Register token accessors with API client
  useEffect(() => {
    setAuthTokenAccessors(
      () => accessToken,
      (token) => setAccessToken(token)
    );
  }, [accessToken]);

  useEffect(() => {
    // On mount, try to restore session using refresh token
    const storedUser = sessionStorage.getItem('user');

    if (storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
      try {
        const userData = JSON.parse(storedUser);

        // Proactively refresh access token using httpOnly refresh cookie
        // CRITICAL: Set user AFTER token refresh to prevent race condition
        fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include', // Send httpOnly cookie
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Empty JSON object to satisfy Fastify
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error('Token refresh failed');
            }
            return res.json();
          })
          .then((data) => {
            const newAccessToken = data.data.access_token;
            if (newAccessToken) {
              setAccessToken(newAccessToken);
              // Now set user to trigger isAuthenticated = true
              setUser(userData);
            } else {
              throw new Error('No access token in response');
            }
          })
          .catch((error) => {
            console.error('❌ Token refresh failed:', error);
            // Clear session and redirect to login
            sessionStorage.removeItem('user');
            setUser(null);
            navigate('/login');
          })
          .finally(() => {
            setIsLoading(false);
          });
      } catch (error) {
        console.error('❌ Failed to parse stored user data:', error);
        sessionStorage.removeItem('user');
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [navigate]);

  const login = (
    accessToken: string,
    _refreshToken: string,
    userData: User,
    onComplete?: () => void
  ) => {
    // Store access token in memory only (XSS protection)
    setAccessToken(accessToken);

    // Store user data in sessionStorage (cleared when tab closes)
    // Less risk than localStorage, but still consider moving to memory-only in future
    if (userData) {
      const userJson = JSON.stringify(userData);
      sessionStorage.setItem('user', userJson);
    }

    setUser(userData);

    // Refresh token is now stored in httpOnly cookie by backend
    // No need to store it in frontend storage (XSS protection)

    // Call completion callback if provided
    if (onComplete) {
      setTimeout(onComplete, 100);
    }
  };

  const updateAccessToken = (newAccessToken: string) => {
    setAccessToken(newAccessToken);
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint to clear httpOnly cookie
      await authService.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local cleanup even if API fails
    }

    // Clear memory
    setAccessToken(null);
    setUser(null);

    // Clear sessionStorage
    sessionStorage.removeItem('user');

    // Clear any legacy storage items
    sessionStorage.removeItem('refresh_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        accessToken,
        login,
        logout,
        updateAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
