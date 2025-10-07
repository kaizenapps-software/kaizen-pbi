import { useEffect, useRef, useState } from "react";
import { initTheme, toggleTheme } from "../lib/theme";
import userAvatar from "../assets/img/Icon App.png";

export default function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    initTheme();
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onToggleTheme = () => {
    toggleTheme();
    setPulse(true);
    setTimeout(() => setPulse(false), 320);
  };

  const toggleSidebar = () => {
    document.dispatchEvent(new CustomEvent("kz:toggleSidebar"));
  };

  const goPowerBi = () =>
    window.open("https://kaizenapps.net/app", "_blank", "noopener,noreferrer");

  const goProfile = () => (window.location.href = "/profile");
  const logout = async () => {
    try { await fetch("/auth/logout", { method: "POST" }); } catch {}
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-50 bg-transparent">
      <div
        className="flex items-center justify-between gap-3 px-3 md:px-4 py-3"
        style={{ height: "var(--topbar-h)" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            aria-label="Abrir menú"
            aria-controls="app-sidebar"
            aria-expanded="false"
            className="hamburger pressable btn-theme"
            title="Abrir menú"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              fill="none"
              strokeWidth="1.8"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>

        {/* Acciones derechas */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            aria-label="Cambiar tema"
            className={`pressable btn-avatar btn-theme ${pulse ? "pulse" : ""}`}
            title="Cambiar tema"
          >
            <span className="icon-theme" aria-hidden="true">
              <svg
                className="sun"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
              <svg
                className="moon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
              </svg>
            </span>
          </button>

          <button
            onClick={goPowerBi}
            className="btn has-sheen pressable"
            title="Ir a la plataforma web"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <ellipse cx="12" cy="12" rx="4" ry="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            <span className="hidden sm:inline">Plataforma</span>
          </button>

          <div ref={wrapRef} className="account-wrap">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="btn-avatar has-sheen pressable"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <img src={userAvatar} alt="Usuario" className="avatar" />
            </button>

            {menuOpen && (
              <nav className="user-menu absolute right-0 top-full mt-2 z-[100]" role="menu">
                <a onClick={goProfile} role="menuitem">
                  <span className="ico">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm7 9a7 7 0 0 0-14 0" />
                    </svg>
                  </span>
                  <span>Mi perfil</span>
                </a>
                <a onClick={logout} role="menuitem">
                  <span className="ico">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <path d="M16 17l5-5-5-5" />
                      <path d="M21 12H9" />
                    </svg>
                  </span>
                  <span>Cerrar sesión</span>
                </a>
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
