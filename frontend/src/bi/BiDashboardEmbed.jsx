import { useEffect, useState } from "react";
import { apiFetchReportOptions } from "../lib/api";
import { buildPbiUrl } from "../lib/pbi";
import Dropdown from "../ui/Dropdown";

export default function BiDashboardEmbed({ style }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    let active = true;
    let loading = false;

    async function loadReports() {
      if (loading) return; // Prevent concurrent calls
      loading = true;

      let license = "";
      try {
        license = JSON.parse(sessionStorage.getItem("kz-auth") || "{}")?.license || "";
      } catch { }

      if (!license) {
        setStatus("no_active_license");
        loading = false;
        return;
      }

      // Check cache first (valid for 5 minutes)
      const cacheKey = `report-options-${license}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 5 * 60 * 1000) { // 5 minutes
            if (!active) return;
            setReports(data.reports);
            const def = data.defaultReportCode || data.reports[0]?.code || "";
            setSelected(def);
            const found = data.reports.find(r => r.code === def);
            const rawUrl = found?.url || "";
            setUrl(rawUrl ? buildPbiUrl({ baseUrl: rawUrl }) : "");
            setStatus(rawUrl ? "ok" : "no_default");
            loading = false;
            return;
          }
        } catch { }
      }

      setStatus("loading");
      try {
        const res = await apiFetchReportOptions(license);
        if (!active) return;

        if (res?.status === "ok" && Array.isArray(res.reports)) {
          // Cache the response
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: res,
            timestamp: Date.now()
          }));

          setReports(res.reports);
          const def = res.defaultReportCode || res.reports[0]?.code || "";
          setSelected(def);
          const found = res.reports.find(r => r.code === def);
          const rawUrl = found?.url || "";
          setUrl(rawUrl ? buildPbiUrl({ baseUrl: rawUrl }) : "");
          setStatus(rawUrl ? "ok" : "no_default");
        } else {
          setStatus(res?.status || "error");
        }
      } catch (err) {
        if (active) setStatus("error");
      } finally {
        loading = false;
      }
    }

    loadReports();
    return () => { active = false; };
  }, []);

  function onChangeReport(code) {
    setSelected(code);
    const r = reports.find(x => x.code === code);
    const rawUrl = r?.url || "";
    setUrl(rawUrl ? buildPbiUrl({ baseUrl: rawUrl }) : "");
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
        <Dropdown
          options={reports.map(r => ({ value: r.code, label: r.name || r.code }))}
          value={selected}
          onChange={onChangeReport}
          className="w-64"
        />
      </div>

      <iframe
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
