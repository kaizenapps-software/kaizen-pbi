import React, { useMemo, useState } from 'react'

const styles = {
  fab: {
    position: 'fixed',
    right: 18,
    bottom: 18,
    display: 'inline-flex',
    gap: 8,
    alignItems: 'center',
    height: 52,
    borderRadius: 26,
    padding: '0 14px',
    border: 0,
    cursor: 'pointer',
    boxShadow: '0 12px 28px rgba(0,0,0,.25)',
    zIndex: 2147483000,
    font: '600 14px/1.1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
    color: '#fff',
    background: '#e11d48',
  },
  icon: { width: 20, height: 20, fill: 'currentColor' },
  panel: {
    position: 'fixed',
    right: 18,
    bottom: 82,
    width: 380,
    height: 560,
    maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100vh - 110px)',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 18px 48px rgba(0,0,0,.35)',
    zIndex: 2147483000,
    background: '#0b0b0b',
  },
  iframe: { width: '100%', height: '100%', border: 0, background: '#0b0b0b' },
  error: {
    position: 'fixed',
    right: 18,
    bottom: 82,
    maxWidth: 380,
    padding: '10px 12px',
    borderRadius: 10,
    color: '#fff',
    background: '#ef4444',
    boxShadow: '0 12px 28px rgba(0,0,0,.25)',
    zIndex: 2147483001,
    font: '500 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
  },
}

function getSS(key, def = '') {
  try { return sessionStorage.getItem(key) || def } catch { return def }
}

function getLicense() {
  const direct = getSS('kaizen.license')
  if (direct) return direct
  try {
    const raw = sessionStorage.getItem('kz-auth') || localStorage.getItem('kz-auth')
    if (raw) {
      const obj = JSON.parse(raw)
      if (obj && obj.license) return obj.license
    }
  } catch {}
  const m = String(location.hash || location.search || '').match(/(?:^|[?#&])license=([A-Z0-9-]{10,})/)
  return m ? decodeURIComponent(m[1]).toUpperCase() : ''
}

async function resolveThread(apiBase, license) {
  const r = await fetch(`${apiBase.replace(/\/+$/,'')}/auth/assist/thread`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license }),
  })
  if (!r.ok) {
    const txt = await r.text().catch(()=> '')
    throw new Error(`thread-resolve-failed:${r.status} ${txt}`)
  }
  return r.json()
}

export default function ChatFab({
  apiBase = import.meta.env.VITE_API_BASE || 'https://kaizen-pbi.onrender.com',
  webBase = 'https://kaizenapps.net/gpt',
  label = 'Asistente',
  theme = 'dark',
  override = {},
}) {
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState('')
  const [error, setError] = useState('')

  const styleFab = useMemo(() => {
    const base = { ...styles.fab }
    if (theme === 'light') base.background = '#0ea5e9'
    return { ...base, ...(override.fab || {}) }
  }, [theme, override])

  const stylePanel = useMemo(() => ({ ...styles.panel, ...(override.panel || {}) }), [override])
  const styleIframe = useMemo(() => ({ ...styles.iframe, ...(override.iframe || {}) }), [override])

  async function handleToggle() {
    const next = !open
    setOpen(next)
    setError('')
    if (!next) return

    try {
      const license = getLicense()
      if (!license) throw new Error('Falta la licencia')

      const prefix  = getSS('kaizen.prefix')
      const client  = getSS('kaizen.clientName')
      const report  = getSS('kaizen.reportCode')

      const info = await resolveThread(apiBase, license)
      const q = new URLSearchParams({
        thread: info.threadId || '',
        assistant: info.assistantId || '',
        prefix: info.prefix || prefix || '',
        client: info.clientName || client || '',
        report: report || '',
        site: 'https://kaizenapps.net',
        app: 'https://kaizenapps.net/app',
        mobile: 'https://kaizenapps.net/mobile',
      })
      const base = webBase.replace(/\/+$/,'')
      const url = /\.html?$/i.test(base) ? `${base}#${q.toString()}` : `${base}/#${q.toString()}`
      setSrc(url)
    } catch (e) {
      setSrc('')
      setError(e?.message || String(e))
      setOpen(false)
      setTimeout(() => setError(''), 6000)
    }
  }

  return (
    <>
      <button type="button" onClick={handleToggle} style={styleFab} aria-label="Abrir chat de ayuda">
        <svg viewBox="0 0 24 24" style={styles.icon}><path d="M12 3c-5 0-9 3.6-9 8 0 2.1.9 4 2.5 5.4L5 21l4-1.7c.9.3 1.9.4 3 .4 5 0 9-3.6 9-8s-4-8-9-8z"/></svg>
        <span>{label}</span>
      </button>
      {open && src && (
        <div style={stylePanel}>
          <iframe title="Kaizen Chat" allow="clipboard-read; clipboard-write; microphone; camera" src={src} style={styleIframe} />
        </div>
      )}
      {error && <div style={styles.error}>{error}</div>}
    </>
  )
}
