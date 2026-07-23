import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api.service.js';
import { TOKEN_KEY } from '../constants/roles.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null);
  const [appLoading, setAppLoading] = useState(true);

  const fetchProfile = useCallback(async (authToken) => {
    if (!authToken) { setAppLoading(false); return; }
    try {
      const res = await authAPI.getProfile();
      if (res.success) setUser(res.user);
      else logout();
    } catch {
      logout();
    } finally {
      setAppLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchProfile(token);
    else setAppLoading(false);
  }, [token]);

  const login = (accessToken, userData) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = () => fetchProfile(token);

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
