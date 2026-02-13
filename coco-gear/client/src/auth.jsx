import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { auth as authApi, sessionEvents, getTokenExpiry } from './api.js';

const AuthContext = createContext(null);

// Refresh the token 5 minutes before it expires
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('slate_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('slate_token'));
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refreshTimerRef = useRef(null);

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

  const logout = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    localStorage.removeItem('slate_token');
    localStorage.removeItem('slate_user');
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Schedule a proactive token refresh before the current token expires.
   * This prevents users from ever hitting a 401 during normal usage.
   */
  const scheduleTokenRefresh = useCallback((currentToken) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const expiry = getTokenExpiry(currentToken);
    if (!expiry) return;

    const msUntilRefresh = expiry - Date.now() - REFRESH_BEFORE_EXPIRY_MS;

    // If already within the refresh window (or past expiry), refresh immediately
    if (msUntilRefresh <= 0) {
      authApi.refresh().then((newToken) => {
        if (newToken) {
          setToken(newToken);
          const savedUser = localStorage.getItem('slate_user');
          if (savedUser) setUser(JSON.parse(savedUser));
          scheduleTokenRefresh(newToken);
        }
      }).catch(() => {
        // Silent failure — the 401 retry mechanism in api.js will handle it
      });
      return;
    }

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const newToken = await authApi.refresh();
        if (newToken) {
          setToken(newToken);
          const savedUser = localStorage.getItem('slate_user');
          if (savedUser) setUser(JSON.parse(savedUser));
          scheduleTokenRefresh(newToken);
        }
      } catch {
        // Silent failure — the 401 retry mechanism in api.js will handle it
      }
    }, msUntilRefresh);
  }, []);

  const login = useCallback(async (userId, pin) => {
    setLoading(true);
    setError('');
    try {
      const { token: newToken, user: userData } = await authApi.login(userId, pin);
      localStorage.setItem('slate_token', newToken);
      localStorage.setItem('slate_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      sessionEvents.dispatchEvent(new CustomEvent('login'));
      scheduleTokenRefresh(newToken);
      return userData;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [scheduleTokenRefresh]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
      localStorage.setItem('slate_user', JSON.stringify(userData));
    } catch {
      logout();
    }
  }, [logout]);

  // Listen for session events from the API layer
  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
    };

    const handleTokenRefreshed = (e) => {
      const { token: newToken, user: userData } = e.detail;
      setToken(newToken);
      setUser(userData);
      scheduleTokenRefresh(newToken);
    };

    const handlePermissionChanged = () => {
      // When a 403 is received, refresh user data to pick up permission changes
      refreshUser();
    };

    sessionEvents.addEventListener('session-expired', handleSessionExpired);
    sessionEvents.addEventListener('token-refreshed', handleTokenRefreshed);
    sessionEvents.addEventListener('permission-changed', handlePermissionChanged);

    return () => {
      sessionEvents.removeEventListener('session-expired', handleSessionExpired);
      sessionEvents.removeEventListener('token-refreshed', handleTokenRefreshed);
      sessionEvents.removeEventListener('permission-changed', handlePermissionChanged);
    };
  }, [logout, refreshUser, scheduleTokenRefresh]);

  // On mount, schedule proactive refresh for existing token
  useEffect(() => {
    if (token) {
      scheduleTokenRefresh(token);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh user data on window focus and every 5 minutes
  // so role/permission changes are reflected without re-login
  useEffect(() => {
    if (!token) return;

    const handleFocus = () => refreshUser();
    window.addEventListener('focus', handleFocus);

    const interval = setInterval(refreshUser, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [token, refreshUser]);

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
