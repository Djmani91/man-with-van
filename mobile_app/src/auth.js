import React, { createContext, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken } from "./api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    try {
      const me = await api.get("/auth/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }

  useEffect(() => {
    (async () => {
      await loadToken();
      await refresh();
      setReady(true);
    })();
  }, []);

  async function login(email, password) {
    const r = await api.post("/auth/login", { email, password });
    await setToken(r.token);
    await refresh();
    return r;
  }
  async function register(payload) {
    const r = await api.post("/auth/register", payload);
    await setToken(r.token);
    await refresh();
    return r;
  }
  async function driverRegister(payload) {
    const r = await api.post("/auth/driver-register", payload);
    await setToken(r.token);
    await refresh();
    return r;
  }
  async function logout() {
    try { await api.post("/auth/logout"); } catch {}
    await setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, driverRegister, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
