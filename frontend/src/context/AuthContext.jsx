import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getAuthToken, setAuthToken, setUnauthorizedHandler } from '../api/client';
import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(getAuthToken()));
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleUnauthorized = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setSessionExpired(true);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  useEffect(() => {
    let active = true;
    const token = getAuthToken();

    if (!token) {
      setAuthLoading(false);
      return undefined;
    }

    fetchCurrentUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          setSessionExpired(false);
        }
      })
      .catch(() => {
        if (active) {
          setAuthToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async ({ email, password }) => {
    setSessionExpired(false);
    const result = await loginUser({ email, password });
    setUser(result.user);
    return result;
  };

  const register = async ({ name, email, password }) => {
    setSessionExpired(false);
    const result = await registerUser({ name, email, password });
    setUser(result.user);
    return result;
  };

  const logout = () => {
    logoutUser();
    setUser(null);
    setSessionExpired(false);
  };

  const clearSessionNotice = () => setSessionExpired(false);

  const value = {
    user,
    isAuthenticated: Boolean(user && getAuthToken()),
    authLoading,
    sessionExpired,
    login,
    register,
    logout,
    clearSessionNotice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
