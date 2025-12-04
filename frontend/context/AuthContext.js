'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (api.isAuthenticated()) {
      try {
        const response = await api.getProfile();
        setUser(response.data);
      } catch {
        api.clearTokens();
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const response = await api.login(email, password);
    setUser(response.data.user);
    return response;
  };

  const register = async (email, password, name) => {
    const response = await api.register(email, password, name);
    setUser(response.data.user);
    return response;
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

