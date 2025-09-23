import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initTheme } from "../lib/theme";
import bgCrimson from "../assets/img/Kaizen Crimson 1.003000.png";
import logoK from "../assets/img/Icon App.png";
import Banner from "../components/Banner";
import { apiUrl, jsonHeaders } from "../lib/api";

const ERRORS_ES = {
  "invalid-license": "Licencia inválida.",
  "license-expired": "La licencia ha expirado.",
  "license-not-active": "La licencia no está activa.",
  "missing-license": "Debes ingresar una licencia.",
  "invalid-signature": "Solicitud inválida.",
  "rate-limited": "Demasiados intentos. Inténtalo en un momento.",
  "server-error": "Ocurrió un error en el servidor.",
  "refresh-failed": "No fue posible iniciar sesión.",
};

const AUTH_KEY = "kz-auth";
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000; // 8h

export default function LoginPage() {
  const [license, setLicense] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState("");
  const [banner, setBanner] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    initTheme();
    inputRef.current?.focus();
    try {
      sessionStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(AUTH_KEY);
    } catch {}
  }, []);

  const errorText = useMemo(() => {
    if (!errorKey) return "";
    return ERRORS_ES[errorKey] || "No fue posible iniciar sesión.";
  }, [errorKey]);

  const handlePaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData("text") || "";
    const raw = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    let prefix = "";
    for (let len = 6; len >= 2; len--) {
      const re = new RegExp(`^[A-Z]{${len}}`);
      if (re.test(raw) && raw.length - len >= 16) { prefix = raw.slice(0, len); break; }
    }
    const rest = (prefix ? raw.slice(prefix.length) : raw).slice(0, 16);
    const g = [rest.slice(0,4), rest.slice(4,8), rest.slice(8,12), rest.slice(12,16)]
      .filter(Boolean).join("-");
    e.preventDefault();
    setLicense(prefix ? `${prefix}-${g}` : g);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner(""); 
    setErrorKey("");

    const code = (license || "").trim().toUpperCase();
    if (!code) { setErrorKey("missing-license"); return; }

    setLoading(true);
    try {
      const r = await fetch(apiUrl("/auth/license/login"), {
      method: "POST",
      headers: jsonHeaders,
      credentials: "include",
      body: JSON.stringify({ license: code }),
      });

    if (r.ok) {
      const client = (code.match(/^[A-Z]{2,6}(?=-)/) || [null])[0];
      const exp = Date.now() + 8 * 60 * 60 * 1000;
    try {
      sessionStorage.setItem("kz-auth", JSON.stringify({ license: code, client, exp }));
      localStorage.removeItem("kz-auth");
      } catch {}
          setSuccess(true);
          navigate("/dashboard", { replace: true });
      return;
  }

    let err = "server-error";
    try {
      const j = await r.json();
      if (j?.error) err = j.error;
    } catch {}
    setErrorKey(err);
  } catch {
    setErrorKey("server-error");
  } finally {
    setLoading(false);
  }
}

  return (
    <div
      className={`page-login min-h-screen relative overflow-hidden login-bg grid lg:grid-cols-2 ${success ? "login-success" : ""}`}
      style={{ "--wall": `url(${bgCrimson})` }}
    >
      <div className="login-vignette" aria-hidden="true" />

      <section className="relative hidden lg:flex flex-col justify-center pl-14 py-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="k-mark">
            <img src={logoK} alt="Kaizen" className="h-11 w-11 object-contain" />
          </div>
          <div>
            <div className="text-xl font-semibold">Kaizen</div>
            <div className="text-sm text-muted">Resource Management</div>
          </div>
        </div>

        <div className={`banner-frame ${success ? "fade-out" : ""}`}>
          <Banner />
        </div>
      </section>

      <section className="flex items-center justify-center px-6">
        <div className="auth-card anim-page w-full max-w-md">
          <header className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted">Introduce tu licencia Kaizen</p>
          </header>

          {banner && <div className="notice notice-ok mb-4">{banner}</div>}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="form-field">
              <label htmlFor="license" className="label">Licencia</label>
              <div className={`input-wrap ${errorText ? "has-error" : ""}`}>
                <span className="leading-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="7" width="18" height="13" rx="2" />
                    <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  id="license"
                  name="license"
                  autoComplete="off"
                  placeholder="AAAA-BBBB-CCCC-DDDD"
                  value={license}
                  onChange={(e) => setLicense(e.target.value.toUpperCase())}
                  onPaste={handlePaste}
                  className="input"
                  aria-invalid={!!errorText}
                  aria-describedby={errorText ? "lic-help" : undefined}
                />
              </div>
              <div id="lic-help" className={`help ${errorText ? "is-error" : "is-muted"}`}>
                {errorText || "Solicita tu licencia desde la plataforma de Kaizen."}
              </div>
            </div>

            <button type="submit" disabled={loading} className={`btn w-full pressable has-sheen ${loading ? "is-loading" : ""}`}>
              {loading ? (<span className="inline-flex items-center gap-2"><span className="spinner" />Entrando…</span>) : "Entrar"}
            </button>
          </form>

          <footer className="mt-6 text-xs opacity-70">
            Al iniciar sesión aceptas los <a href="#" className="text-foreground" style={{ color: "#ef4444" }}>términos y condiciones</a>.
          </footer>
        </div>
      </section>

      {success && (
        <div className="success-overlay" aria-hidden="true">
          <div className="kz-curtain-shape" />
        </div>
      )}
    </div>
  );
}
