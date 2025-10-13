import { useEffect, useMemo, useState } from "react";
import { apiFetchClientInfo } from "../lib/api";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { motion } from "framer-motion";

const KEY = "kz-auth";
const TZ = "America/Costa_Rica";

function readAuth() {
  try {
    const raw = sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function maskLicense(lic) {
  if (!lic) return "";
  const parts = String(lic).split("-");
  if (parts.length !== 5) return lic;
  return `${parts[0]}-****-****-****-${parts[4]}`;
}

function fmtDateES(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(+dt)) return String(d);
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric", month: "long", day: "2-digit",
    timeZone: TZ,
  }).format(dt);
}

function fmtExpiryES(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(+dt)) return String(d);
  const dateStr = new Intl.DateTimeFormat("es-CR", {
    year: "numeric", month: "long", day: "2-digit",
    timeZone: TZ,
  }).format(dt);
  const hm = new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ,
  }).format(dt);
  const article = hm.startsWith("1:") ? "a la" : "a las";
  return `${dateStr} ${article} ${hm}`;
}

function fmtRemaining(ms) {
  if (ms == null) return "";
  if (ms <= 0) return "expirada";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days} día${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hora${hours !== 1 ? "s" : ""}`);
  parts.push(`${minutes} minuto${minutes !== 1 ? "s" : ""}`);
  return parts.length > 1
    ? parts.slice(0, -1).join(", ") + " y " + parts.slice(-1)
    : parts[0];
}

function statusBadge(status) {
  const map = {
    active:   { label: "activo",   dot: "bg-emerald-500", text: "text-emerald-500" },
    expired:  { label: "expirada", dot: "bg-red-500",     text: "text-red-500" },
    revoked:  { label: "revocada", dot: "bg-neutral-400", text: "text-neutral-400" },
  };
  const s = map[status] || { label: String(status || "desconocido"), dot: "bg-amber-500", text: "text-amber-500" };
  return (
    <span className={`inline-flex items-center gap-2 ${s.text}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${s.dot}`} aria-hidden="true" />
      <span className="capitalize">{s.label}</span>
    </span>
  );
}

export default function ProfilePage() {
  const auth = useMemo(readAuth, []);
  const prefix = auth?.client || "";
  const masked = maskLicense(auth?.license);

  const [data, setData] = useState(null);
  const [status, setSt] = useState("loading");
  const [error, setError] = useState("");
  const [chipsParent] = useAutoAnimate({ duration: 180 });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => { try { sessionStorage.removeItem("kz-expire-redirect"); } catch {} }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!prefix) { setSt("no_prefix"); return; }
    apiFetchClientInfo(prefix)
      .then((r) => { if (!alive) return; setData(r); setSt("ok"); })
      .catch((e) => { if (!alive) return; setError(e?.message || "error"); setSt("error"); });
    return () => { alive = false; };
  }, [prefix]);

  const serverStatus = (data?.license?.status || "").toLowerCase();
  useEffect(() => {
    if (serverStatus !== "expired") return;
    if (sessionStorage.getItem("kz-expire-redirect") === "1") return;
    sessionStorage.setItem("kz-expire-redirect", "1");
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem("kz-auth");
        localStorage.removeItem("kz-auth");
        sessionStorage.removeItem("kaizen.license");
        sessionStorage.removeItem("kaizen.prefix");
        sessionStorage.removeItem("kaizen.clientName");
        sessionStorage.removeItem("kaizen.reportCode");
      } catch {}
      window.location.href = "/login";
    }, 500);
    return () => clearTimeout(t);
  }, [serverStatus]);

  if (status !== "ok") {
    return (
      <motion.div
        className="max-w-3xl mx-auto p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        <h1 className="text-2xl font-semibold mb-4">Mi perfil</h1>
        <div className="p-4 rounded-xl border border-border bg-[var(--color-panel)] text-sm">
          {status === "loading" && "Cargando…"}
          {status === "no_prefix" && "No hay licencia activa."}
          {status === "error" && `No se pudo cargar el perfil: ${error}`}
        </div>
      </motion.div>
    );
  }

  const clientName = data?.client?.name || prefix;
  const reports = Array.isArray(data?.reports) ? data.reports : [];
  const defCode = data?.defaultReportCode || null;

  const expiryRaw = data?.license?.expiryAt ?? data?.license?.expiryDate ?? null;
  const expiryTs = typeof expiryRaw === "string"
    ? Date.parse(expiryRaw)
    : (expiryRaw ? new Date(expiryRaw).getTime() : NaN);
  const remainingMs = Number.isFinite(expiryTs) ? (expiryTs - nowMs) : null;
  const isExpiredComputed = Number.isFinite(expiryTs) && remainingMs <= 0;
  const isExpired = isExpiredComputed || serverStatus === "expired";

  return (
    <motion.div
      className="max-w-5xl mx-auto p-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <h1 className="text-2xl font-semibold mb-5">Mi perfil</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <motion.section
          className="rounded-2xl border border-border bg-[var(--color-panel)] p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          <h2 className="text-sm text-muted mb-1">Cliente</h2>
          <div className="text-lg font-semibold">{clientName}</div>
          <div className="text-sm text-muted mt-1">Código: <span className="font-medium">{prefix}</span></div>

          <div className="mt-5">
            <h3 className="text-sm text-muted mb-2">Reportes disponibles</h3>
            <div ref={chipsParent} className="flex flex-wrap gap-2">
              {reports.length === 0 && <span className="text-sm text-muted">—</span>}
              {reports.map(r => {
                const label = r.name || r.code;
                const isDef = r.code === defCode || r.isDefault;
                return (
                  <span
                    key={r.code}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm animate-fade"
                  >
                    <span className="opacity-80">{label}</span>
                    <span className="opacity-80">({label})</span>
                    {isDef && <span className="ml-1 text-amber-400 text-[11px]">★ Predeterminado</span>}
                  </span>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section
          className="rounded-2xl border border-border bg-[var(--color-panel)] p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.06 }}
        >
          <h2 className="text-sm text-muted mb-1">Licencia</h2>
          <div className="text-lg font-semibold">{masked}</div>

          <div className="text-sm text-muted mt-2">
            Estado: {statusBadge(isExpired ? "expired" : data?.license?.status)}
            <span className="mx-2">·</span>
            Expira el: <span className="font-medium">{expiryRaw ? fmtExpiryES(expiryRaw) : "—"}</span>
            {expiryRaw && (
              <span className={`ml-2 italic ${isExpired ? "text-red-500" : "text-muted"}`}>
                ({fmtRemaining(remainingMs)})
              </span>
            )}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
