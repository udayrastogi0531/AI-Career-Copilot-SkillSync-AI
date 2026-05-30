import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("career_copilot_token") || "");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("career_copilot_user");
    if (!saved) {
      return null;
    }
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem("career_copilot_user");
      return null;
    }
  });

  const login = async (payload) => {
    const { data } = await api.post("/auth/login", payload);
    setSession(data.user, data.token);
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/signup", payload);
    return data;
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("career_copilot_token");
    localStorage.removeItem("career_copilot_user");
  };

  const setSession = (nextUser, nextToken) => {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem("career_copilot_token", nextToken);
    localStorage.setItem("career_copilot_user", JSON.stringify(nextUser));
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
