const API_BASE = import.meta.env.VITE_API_BASE || ''

export const jsonHeaders = { 'Content-Type': 'application/json' }

export function apiUrl(path = '') {
  if (!API_BASE) return path
  if (path.startsWith('http')) return path
  return `${API_BASE}${path}`
}

function timeoutSignal(ms) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort('timeout'), ms)
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) }
}

export async function apiRequest(path, opts = {}) {
  const { signal, cancel } = timeoutSignal(20000)
  const init = { ...opts, signal }
  init.headers = init.headers || {}
  if (init.body && !(init.body instanceof FormData)) init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json'
  try {
    const res = await fetch(apiUrl(path), init)
    let data = null
    try { data = await res.json() } catch {}
    if (!res.ok) {
      const msg = (data && (data.status || data.error)) || 'error'
      throw new Error(msg)
    }
    return data
  } finally {
    cancel()
  }
}

export async function apiLoginByLicense(license) {
  return apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ license }), credentials: 'include' })
}

export async function apiFetchHome(prefix) {
  return apiRequest(`/reports/home?prefix=${encodeURIComponent(prefix)}`, { credentials: 'include' })
}

export async function apiFetchReport(prefix, reportCode) {
  return apiRequest(`/reports/${encodeURIComponent(reportCode)}?prefix=${encodeURIComponent(prefix)}`, { credentials: 'include' })
}

export default { apiUrl, jsonHeaders, apiRequest, apiLoginByLicense, apiFetchHome, apiFetchReport }
