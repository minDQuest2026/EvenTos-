import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("fgl_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (userId) => {
    setLoading(true);
    try {
      const data = await api.devLogin(userId);
      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem("fgl_user", JSON.stringify(data.user));
        localStorage.setItem("fgl_dev_token", data.token || data.user.id);
        return data.user;
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("fgl_user");
    localStorage.removeItem("fgl_dev_token");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
