import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  async function fetchMe() {
    try {
      const r = await fetch(apiUrl("/auth/me"), { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setUser(j.user);
      else setUser(null);
    } catch {
      setUser(null);
    } finally {
      setHydrated(true);
    }
  }

  useEffect(() => { fetchMe(); }, []);

  const login = async ({ license }) => {
    const r = await fetch(apiUrl("/auth/license/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ license }),
    });
    if (!r.ok) {
      let msg = "Licencia inválida";
      try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    await fetchMe();
    navigate("/dashboard", { replace: true });
  };

  const logout = async () => {
    await fetch(apiUrl("/auth/logout"), { method: "POST", credentials: "include" });
    setUser(null);
    navigate("/login", { replace: true });
  };

  const value = useMemo(() => ({ user, isAuth: !!user, login, logout, hydrated }), [user, hydrated]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}
