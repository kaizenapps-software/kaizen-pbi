const RAW_BASE = import.meta.env.VITE_API_BASE || '';
const API_BASE = RAW_BASE
  ? RAW_BASE.replace(/\/+$/, '') 
  : '';                           

export const jsonHeaders = { 'Content-Type': 'application/json' };

export function apiUrl(path = '') {
  if (!API_BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

function timeoutSignal(ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(new DOMException('timeout','AbortError')), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

export async function apiRequest(path, opts = {}) {
  const { signal, cancel } = timeoutSignal(20000);
  try {
    const init = {
      credentials: 'include',   
      ...opts,
      signal,
      headers: { ...(opts.headers || {}) },
    };

    if (init.body && !(init.body instanceof FormData)) {
      init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
    }

    const res = await fetch(apiUrl(path), init);

    let data = null;
    const text = await res.text().catch(() => '');
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }

    if (!res.ok) {
      const msg = (data && (data.status || data.error)) || `${res.status}`;
      throw new Error(msg);
    }
    return data ?? { ok: true };
  } catch (e) {
    if (e?.name === 'AbortError') throw new Error('timeout');
    throw e;
  } finally {
    cancel();
  }
}

export function apiLoginByLicense(license) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ license }),
  });
}

export function apiFetchHome(prefix) {
  return apiRequest(`/reports/home?prefix=${encodeURIComponent(prefix)}`);
}

export function apiFetchReport(prefix, reportCode) {
  return apiRequest(`/reports/${encodeURIComponent(reportCode)}?prefix=${encodeURIComponent(prefix)}`);
}

export default { apiUrl, jsonHeaders, apiRequest, apiLoginByLicense, apiFetchHome, apiFetchReport };

export async function apiFetchClientInfo(prefix) {
  return apiRequest(`/reports/client-info?prefix=${encodeURIComponent(prefix)}`, { credentials: 'include' });
}
