import { useEffect, useMemo, useState } from "react";
import { apiFetchClientInfo } from "../lib/api";

function readAuth() {
  try {
    const raw = sessionStorage.getItem("kz-auth") || localStorage.getItem("kz-auth");
    if (!raw) return null;
    const a = JSON.parse(raw);
    if (!a?.license || !a?.client) return null;
    return a;
  } catch { return null; }
}

export default function ProfilePage(){
  const auth = useMemo(readAuth, []);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    if (!auth?.client) { setLoading(false); setErr("no_active_license"); return; }
    apiFetchClientInfo(auth.client)
      .then((r) => { if (!active) return; if (r?.status === "ok") setInfo(r); else setErr(r?.error || r?.status || "error"); })
      .catch((e) => { if (active) setErr(String(e?.message || "error")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth?.client]);

  const masked = (auth?.license || "").replace(/^([A-Z]{2,6})-/, "$1-").replace(/(.{4})-(.{4})-(.{4})-(.{4})$/, "****-****-****-$4");

  return (
    <div className="max-w-3xl mx-auto p-6 anim-page">
      <h1 className="text-2xl font-semibold mb-4">Mi perfil</h1>

      <div className="rounded-2xl border border-border bg-[var(--color-panel)] p-5 shadow-soft has-sheen">
        {loading && <p className="text-sm text-muted">Cargando…</p>}

        {!loading && err && (
          <div className="text-sm text-red-500">No fue posible obtener la información ({err}).</div>
        )}

        {!loading && !err && info && (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted">Cliente</div>
                <div className="text-lg font-medium">{info.client.name}</div>
                <div className="text-sm text-muted">Prefijo: {info.client.prefix}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Licencia</div>
                <div className="text-lg font-medium">{masked}</div>
                {info.license && (
                  <div className="text-sm text-muted">
                    Estado: {info.license.status} · Expira: {info.license.expiryDate || "—"}
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="text-xs text-muted mb-2">Reportes disponibles</div>
              {info.reports?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {info.reports.map(r => (
                    <li key={r.code} className="px-3 py-1 rounded-full border border-border bg-[color-mix(in_oklab,var(--color-panel) 90%,#000_10%)]">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted ml-2 text-xs">({r.code})</span>
                      {r.isDefault ? <span className="ml-2 text-xs text-amber-500">★ default</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted">No hay reportes activos para este cliente.</div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
