import { useEffect, useMemo, useState } from "react";
import { apiFetchClientInfo } from "../lib/api";

const KEY = "kz-auth";

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
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric", month: "long", day: "2-digit",
    timeZone: "UTC"
  }).format(dt);
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

  const [data, setData]   = useState(null);
  const [status, setSt]   = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    if (!prefix) { setSt("no_prefix"); return; }
    apiFetchClientInfo(prefix)
      .then((r) => { if (!alive) return; setData(r); setSt("ok"); })
      .catch((e) => { if (!alive) return; setError(e?.message || "error"); setSt("error"); });
    return () => { alive = false; };
  }, [prefix]);

  if (status !== "ok") {
    return (
      <div className="max-w-3xl mx-auto p-6 anim-page">
        <h1 className="text-2xl font-semibold mb-4">Mi perfil</h1>
        <div className="p-4 rounded-xl border border-border bg-[var(--color-panel)] text-sm">
          {status === "loading" && "Cargando…"}
          {status === "no_prefix" && "No hay licencia activa."}
          {status === "error" && `No se pudo cargar el perfil: ${error}`}
        </div>
      </div>
    );
  }

  const clientName = data?.client?.name || prefix;
  const reports = Array.isArray(data?.reports) ? data.reports : [];
  const defCode = data?.defaultReportCode || null;

  return (
    <div className="max-w-5xl mx-auto p-6 anim-page">
      <h1 className="text-2xl font-semibold mb-5">Mi perfil</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Cliente */}
        <section className="rounded-2xl border border-border bg-[var(--color-panel)] p-5">
          <h2 className="text-sm text-muted mb-1">Cliente</h2>
          <div className="text-lg font-semibold">{clientName}</div>
          <div className="text-sm text-muted mt-1">Prefijo: <span className="font-medium">{prefix}</span></div>

          <div className="mt-5">
            <h3 className="text-sm text-muted mb-2">Reportes disponibles</h3>
            <div className="flex flex-wrap gap-2">
              {reports.length === 0 && <span className="text-sm text-muted">—</span>}
              {reports.map(r => {
                const label = r.name || r.code;
                const isDef = r.code === defCode || r.isDefault;
                return (
                  <span key={r.code}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
                    <span className="opacity-80">{label}</span>
                    <span className="opacity-80">({label})</span>
                    {isDef && <span className="ml-1 text-amber-400 text-[11px]">★ default</span>}
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        {/* Licencia */}
        <section className="rounded-2xl border border-border bg-[var(--color-panel)] p-5">
          <h2 className="text-sm text-muted mb-1">Licencia</h2>
          <div className="text-lg font-semibold">{masked}</div>

          <div className="text-sm text-muted mt-2">
            Estado: {statusBadge(data?.license?.status)}
            <span className="mx-2">·</span>
            Expira: <span className="font-medium">{fmtDateES(data?.license?.expiryDate)}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
