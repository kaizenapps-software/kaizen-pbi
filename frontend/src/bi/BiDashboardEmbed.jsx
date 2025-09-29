import { useEffect, useState } from "react"
import { apiFetchHome } from "../lib/api"

export default function BiDashboardEmbed({ style }) {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState("idle")

  useEffect(() => {
    let active = true
    const raw = sessionStorage.getItem("kz-auth")
    let prefix = ""
    try {
      const obj = raw ? JSON.parse(raw) : null
      prefix = obj?.client || ""
    } catch {}
    if (!prefix) { setStatus("no_active_license"); return }
    setStatus("loading")
    apiFetchHome(prefix).then(res => {
      if (!active) return
      if (res && res.status === "ok" && res.url) {
        setUrl(res.url)
        setStatus("ok")
      } else {
        setStatus(res?.status || "error")
      }
    }).catch(() => { if (active) setStatus("error") })
    return () => { active = false }
  }, [])

  if (status !== "ok") {
    return <div className="w-full h-[60vh] flex items-center justify-center text-sm">{status === "loading" ? "Cargando..." : "No fue posible cargar el reporte"}</div>
  }

  return <iframe title="pbi" src={url} className="w-full h-full border-0" style={style} allowFullScreen />
}
