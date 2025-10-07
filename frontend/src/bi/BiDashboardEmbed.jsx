import { useEffect, useState } from "react";
import { apiFetchReportOptions } from "../lib/api";

export default function BiDashboardEmbed({ style }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    let active = true;
    let license = "";
    try { license = JSON.parse(sessionStorage.getItem("kz-auth") || "{}")?.license || ""; } catch {}
    if (!license) { setStatus("no_active_license"); return; }

    setStatus("loading");
    apiFetchReportOptions(license).then(res => {
      if (!active) return;
      if (res?.status === "ok" && Array.isArray(res.reports)) {
        setReports(res.reports);
        const def = res.defaultReportCode || res.reports[0]?.code || "";
        setSelected(def);
        const found = res.reports.find(r => r.code === def);
        setUrl(found?.url || "");
        setStatus(found?.url ? "ok" : "no_default");
      } else {
        setStatus(res?.status || "error");
      }
    }).catch(() => active && setStatus("error"));
    return () => { active = false; };
  }, []);

  function onChangeReport(code) {
    setSelected(code);
    const r = reports.find(x => x.code === code);
    setUrl(r?.url || "");
  }

  if (status !== "ok") {
    return <div className="w-full h-[60vh] flex items-center justify-center text-sm">
      {status === "loading" ? "Cargando…" : "No fue posible cargar los reportes"}
    </div>;
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted">Reporte:</label>
        <select
          className="border border-border bg-transparent rounded-md px-2 py-1 text-sm"
          value={selected}
          onChange={e => onChangeReport(e.target.value)}
        >
          {reports.map(r => (
            <option key={r.code} value={r.code}>{r.name || r.code}</option>
          ))}
        </select>
      </div>

      <iframe
        key={url}
        title="pbi"
        src={url}
        className="w-full h-full border-0"
        style={style}
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
