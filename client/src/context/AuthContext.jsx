import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api.service.js';
import { TOKEN_KEY } from '../constants/roles.js';
import apiClient from '../lib/axios.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null);
  const [appLoading, setAppLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await authAPI.getProfile();
      if (res.success) {
        setUser(res.user);
      } else {
        await logout();
      }
    } catch (err) {
      console.error('Fetch profile failed:', err);
      await logout();
    } finally {
      setAppLoading(false);
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      // Try to restore session via refresh token if HttpOnly cookie exists
      try {
        const refreshRes = await apiClient.post('/auth/refresh');
        if (refreshRes.success && refreshRes.accessToken) {
          localStorage.setItem(TOKEN_KEY, refreshRes.accessToken);
          setToken(refreshRes.accessToken);
          // fetchProfile will be triggered by useEffect when token changes
          return;
        }
      } catch (err) {
        console.log('Initial silent session restore failed.');
      }
      setAppLoading(false);
      return;
    }

    // Access token is available, validate it
    await fetchProfile();
  }, [fetchProfile]);

  // Run initialization on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Listen to global auth_session_expired event from Axios interceptor
  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
    };
    window.addEventListener('auth_session_expired', handleSessionExpired);
    return () => window.removeEventListener('auth_session_expired', handleSessionExpired);
  }, []);

  // Sync token changes to fetchProfile
  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token, fetchProfile]);

  const login = (accessToken, userData) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      // call logout endpoint to clear HttpOnly cookies on the backend
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Backend logout failed:', err);
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = () => fetchProfile();

  return (
    <AuthContext.Provider value={{ user, token, appLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export default AuthContext;
