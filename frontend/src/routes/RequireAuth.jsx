import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { apiUrl } from "../lib/api";

const KEY = "kz-auth";

/* ========= store helpers ========= */
function readAuth() {
  try {
    const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw);
    if (!a?.license) return null;
    if (a.exp && Date.now() > a.exp) return null; 
    return a;
  } catch {
    return null;
  }
}

function writeAuth(data) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
    localStorage.removeItem(KEY);
  } catch {}
}

function clearAuth() {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {}
}

/* ========= guard ========= */
export default function RequireAuth({ children }) {
  const loc = useLocation();
  const nav = useNavigate();

  const auth = useMemo(readAuth, [loc.key]);

  useEffect(() => {
    let disposed = false;

    async function revalidate() {
      const a = readAuth();
      if (!a) return;

      const shouldPing = !a.exp || a.exp - Date.now() < 60_000;

      if (!shouldPing) return;

      try {
         const r = await fetch(apiUrl("/auth/me"), { credentials: "include" });
        if (!r.ok) throw new Error("no-session");

        const j = await r.json().catch(() => ({}));
        if (j?.exp && Number.isFinite(+j.exp)) {
          writeAuth({ ...a, exp: +j.exp });
        }
      } catch {
        if (disposed) return;
        clearAuth();
        nav("/login", { replace: true });
      }
    }

    revalidate();
    const onVis = () => document.visibilityState === "visible" && revalidate();
    const id = setInterval(revalidate, 5 * 60_000);

    window.addEventListener("visibilitychange", onVis);
    return () => {
      disposed = true;
      window.removeEventListener("visibilitychange", onVis);
      clearInterval(id);
    };
  }, [nav, loc.pathname]);

  if (!auth) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  return children ?? <Outlet />;
}
