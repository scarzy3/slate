import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { auth as authApi, personnel as personnelApi } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('coco_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('coco_token'));
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLoggedIn = !!token && !!user;

  // Load user list for login screen (public endpoint, no auth needed)
  const loadUsers = useCallback(async () => {
    try {
      const data = await authApi.getUsers();
      setAllUsers(data);
    } catch {
      // Fallback: login screen will show text input if user list unavailable
    }
  }, []);

  const login = useCallback(async (userId, pin) => {
    setLoading(true);
    setError('');
    try {
      const { token: newToken, user: userData } = await authApi.login(userId, pin);
      localStorage.setItem('coco_token', newToken);
      localStorage.setItem('coco_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('coco_token');
    localStorage.removeItem('coco_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
      localStorage.setItem('coco_user', JSON.stringify(userData));
    } catch {
      logout();
    }
  }, [logout]);

  const value = {
    user,
    token,
    allUsers,
    isLoggedIn,
    loading,
    error,
    login,
    logout,
    loadUsers,
    refreshUser,
    setUser,
    setError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default AuthContext;
