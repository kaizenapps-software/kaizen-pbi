export default function BiDashboardEmbed({ className="", style={} }){
  const base =
    (import.meta.env.VITE_PBI_PUBLISH_TO_WEB_URL ?? "").trim() ||
    (import.meta.env.VITE_PBI_SECURE_EMBED_URL ?? "").trim() ||
    ""

  if(!base) {
    return <div className="card p-6 text-sm text-muted">Ha ocurrido un error</div>
  }

  return (
    <div className={`embed-ambient w-full overflow-hidden rounded-2xl border border-border shadow-soft bg-panel ${className}`} style={style}>
      <iframe
        title="Power BI"
        src={base}
        className="w-full block relative z-0"
        style={{ height: "100%", border: 0, background: "transparent" }}
        allowFullScreen
      />
    </div>
  )
}
