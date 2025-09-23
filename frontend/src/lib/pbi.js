export function buildPbiUrl({ baseUrl, table, column, range = "M" }) {
  if (!baseUrl) return ""
  const url = new URL(baseUrl)
  if (!url.searchParams.has("navContentPaneEnabled")) url.searchParams.set("navContentPaneEnabled", "false")
  if (!url.searchParams.has("filterPaneEnabled")) url.searchParams.set("filterPaneEnabled", "false")
  const now = new Date()
  const utcDate = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const pad = (n) => String(n).padStart(2, "0")
  const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  let start
  if (range === "W") { const d = utcDate(now); const dow = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() - (dow - 1)); start = d }
  else if (range === "Y") start = new Date(Date.UTC(now.getFullYear(), 0, 1))
  else start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const end = utcDate(now)
  const s = fmt(start), e = fmt(end)
  const L = `datetime'${s}T00:00:00Z'`; const R = `datetime'${e}T23:59:59Z'`
  if (table && column) url.searchParams.set("filter", `${table}/${column} ge ${L} and ${table}/${column} le ${R}`)
  url.searchParams.set("_ts", String(Date.now()))
  return url.toString()
}
