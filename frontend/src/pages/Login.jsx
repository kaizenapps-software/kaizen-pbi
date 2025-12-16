import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initTheme } from "../lib/theme";
import bgCrimson from "../assets/img/Kaizen Crimson 1.003000.png";
import logoK from "../assets/img/Icon App.png";
import Banner from "../components/Banner";
import { apiUrl, jsonHeaders } from "../lib/api";
import { motion } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

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
const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

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
    try { sessionStorage.removeItem(AUTH_KEY); localStorage.removeItem(AUTH_KEY); } catch { }
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
    const g = [rest.slice(0, 4), rest.slice(4, 8), rest.slice(8, 12), rest.slice(12, 16)].filter(Boolean).join("-");
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const r = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: jsonHeaders,
        credentials: "include",
        body: JSON.stringify({ license: code }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      console.log('[Login] Response status:', r.status);

      if (r.ok) {
        const j = await r.json().catch(() => null);
        console.log('[Login] Success payload:', j);
        const client = j?.prefix || (code.match(/^[A-Z]{2,6}(?=-)/) || [null])[0];

        try {
          sessionStorage.setItem("kaizen.license", code);
          sessionStorage.setItem("kaizen.prefix", client || "");

          console.log('[Login] Fetching client info for:', client);
          const ctrl2 = new AbortController();
          const to2 = setTimeout(() => ctrl2.abort(), 5000);

          const r2 = await fetch(apiUrl(`/reports/client-info?prefix=${client}`), {
            credentials: "include",
            signal: ctrl2.signal
          });
          clearTimeout(to2);

          const info = await r2.json().catch(() => null);
          console.log('[Login] Client info:', info);

          if (r2.ok && info?.client) {
            sessionStorage.setItem("kaizen.clientName", info.client.name || client || "");
            if (info.defaultReportCode) sessionStorage.setItem("kaizen.reportCode", info.defaultReportCode);
          } else {
            sessionStorage.setItem("kaizen.clientName", client || "");
          }
        } catch (err) {
          console.warn('[Login] Metadata fetch failed:', err);
        }

        const exp = Date.now() + DEFAULT_TTL_MS;
        try { sessionStorage.setItem("kz-auth", JSON.stringify({ license: code, client, exp })); localStorage.removeItem("kz-auth"); } catch { }

        setSuccess(true);
        navigate("/dashboard", { replace: true });
        return;
      }

      let err = "server-error";
      try {
        const j = await r.json();
        const s = j?.status || j?.error;
        if (s === "expired") err = "license-expired";
        else if (s === "revoked") err = "license-not-active";
        else if (s === "mismatch_or_not_found") err = "invalid-license";
        else if (typeof s === "string") err = s;
      } catch { }
      setErrorKey(err);
    } catch (e) {
      setErrorKey(e.name === 'AbortError' ? 'server-error' : 'server-error');
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
        <motion.div
          className="mb-6 flex items-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <div className="k-mark">
            <img src={logoK} alt="Kaizen" className="h-11 w-11 object-contain" />
          </div>
          <div>
            <div className="text-xl font-semibold">Kaizen</div>
            <div className="text-sm text-muted">Resource Management</div>
          </div>
        </motion.div>

        <motion.div
          className={`banner-frame ${success ? "fade-out" : ""}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34 }}
        >
          <Banner />
        </motion.div>
      </section>

      <section className="flex items-center justify-center px-6">
        <motion.div
          className="auth-card w-full max-w-md animate-fade"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28 }}
        >
          <header className="mb-6">
            <h2 className="text-xl font-semibold text-foreground">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-muted">Introduce tu licencia Kaizen</p>
          </header>

          {banner && <div className="notice notice-ok mb-4 animate-fade">{banner}</div>}

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
                  placeholder="AAA-BBBB-CCCC-DDDD"
                  value={license}
                  onChange={(e) => e.target.value && setLicense(e.target.value.toUpperCase())}
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
        </motion.div>
      </section>

      {success && (
        <div className="success-overlay grid place-items-center" aria-hidden="true">
          <DotLottieReact src="/anim/success.lottie" loop={false} autoplay className="w-24 h-24" />
        </div>
      )}
    </div>
  );
}