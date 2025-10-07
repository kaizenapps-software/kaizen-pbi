import { useEffect, useState } from "react";
import { apiFetchHome } from "../lib/api";

export default function BiDashboardEmbed({ style }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let active = true;
    let prefix = "";
    try {
      const raw = sessionStorage.getItem("kz-auth");
      const obj = raw ? JSON.parse(raw) : null;
      prefix = obj?.client || "";
    } catch {}
    if (!prefix) { setStatus("no_active_license"); return; }

    setStatus("loading");
    apiFetchHome(prefix)
      .then((res) => {
        if (!active) return;
        if (res?.status === "ok" && res?.url) {
          setUrl(res.url);
          setStatus("ok");
        } else {
          setStatus(res?.status || "error");
          setMsg(res?.error || "");
        }
      })
      .catch((e) => {
        if (!active) return;
        setStatus("error");
        setMsg(String(e?.message || ""));
      });

    return () => { active = false; };
  }, []);

  if (status !== "ok") {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center text-sm">
        {status === "loading" ? "Cargando..." : `No fue posible cargar el reporte${msg ? `: ${msg}` : ""}`}
      </div>
    );
  }

  return (
    <iframe
    key={url}
    title="pbi"
    src={url}
    className={`w-full h-full border-0 ${!style ? "bi-frame" : ""}`}
    style={style}
    allow="fullscreen"
    allowFullScreen
    referrerPolicy="no-referrer"
    />
  );

}
