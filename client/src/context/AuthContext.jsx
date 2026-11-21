import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('ake_token') || null);
  const [loading, setLoading] = useState(true);

  // Load current user profile from token on mount
  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('ake_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await apiRequest('/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('[AuthContext] Token validation failed:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('ake_token');
    };
    window.addEventListener('ake:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('ake:unauthorized', handleUnauthorized);
  }, []);

  // Send Email / Mobile OTP
  const sendOtp = async (identifier) => {
    let body = {};
    if (typeof identifier === 'string') {
      const trimmed = identifier.trim();
      if (trimmed.includes('@')) {
        body = { email: trimmed.toLowerCase() };
      } else {
        body = { mobile: trimmed };
      }
    } else if (identifier && typeof identifier === 'object') {
      body = identifier;
    }

    return await apiRequest('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  };

  // Verify OTP
  const verifyOtp = async (identifier, otp, name) => {
    let body = { otp, name };
    if (typeof identifier === 'string') {
      const trimmed = identifier.trim();
      if (trimmed.includes('@')) {
        body.email = trimmed.toLowerCase();
      } else {
        body.mobile = trimmed;
      }
    } else if (identifier && typeof identifier === 'object') {
      body = { ...identifier, otp: otp || identifier.otp, name: name || identifier.name };
    }

    const res = await apiRequest('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('ake_token', res.token);
    }
    return res;
  };

  // Google Login
  const googleLogin = async (googleData) => {
    const res = await apiRequest('/auth/google', {
      method: 'POST',
      body: JSON.stringify(googleData)
    });

    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('ake_token', res.token);
    }
    return res;
  };

  // Password / Admin Login
  const passwordLogin = async (credentials) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (res.success && res.token) {
      setToken(res.token);
      setUser(res.user);
      localStorage.setItem('ake_token', res.token);
    }
    return res;
  };

  // Update profile
  const updateProfile = async (profileData) => {
    const res = await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });

    if (res.success && res.user) {
      setUser(prev => ({ ...prev, ...res.user }));
    }
    return res;
  };

  // Logout
  const logout = () => {
    try {
      apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {}
    localStorage.removeItem('ake_token');
    setToken(null);
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isPosStaff = false;
  const isSuperAdmin = isAdmin && (
    user?.isSuperAdmin === true ||
    (user?.email && user.email.toLowerCase().trim() === 'akerice1527@gmail.com')
  ) && (user?.email && user.email.toLowerCase().trim() !== 'kaviyansellappan15@gmail.com');

  const hasPermission = (permKey) => {
    if (!user) return false;
    if (isSuperAdmin) return true;
    if (user.role !== 'admin') return false;
    if (!user.permissions) return false;
    if (permKey === 'sales_pos') return !!user.permissions.sales_pos;
    if (permKey === 'orders' || permKey === 'whatsapp_orders') {
      return !!(user.permissions.orders || user.permissions.whatsapp_orders);
    }
    if (permKey === 'products' || permKey === 'inventory') {
      return !!(user.permissions.products || user.permissions.inventory);
    }
    if (permKey === 'customers') return true;
    return !!user.permissions[permKey];
  };

  const refreshUser = async () => {
    try {
      const res = await apiRequest('/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
      }
    } catch (e) {}
  };

  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated,
        isAdmin,
        isPosStaff,
        isSuperAdmin,
        hasPermission,
        refreshUser,
        role: user?.role || 'guest',
        sendOtp,
        verifyOtp,
        googleLogin,
        passwordLogin,
        updateProfile,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
