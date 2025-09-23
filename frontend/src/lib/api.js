const API_BASE = import.meta.env.VITE_API_BASE || "";
export const apiUrl = (p) => (API_BASE ? `${API_BASE}${p}` : p);
export const jsonHeaders = { "content-type": "application/json" };
