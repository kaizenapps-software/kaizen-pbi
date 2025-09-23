const KEY = "kaizen.dark";

/** Aplica el tema guardado o el de sistema en el primer render */
export function initTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = saved == null ? prefers : saved === "1";
    document.documentElement.classList.toggle("dark", dark);
  } catch {}
}

/** Cambia el tema con una animación corta */
export function toggleTheme() {
  const html = document.documentElement;
  const next = !html.classList.contains("dark");

  html.classList.add("theme-anim");
  requestAnimationFrame(() => {
    html.classList.toggle("dark", next);
    setTimeout(() => html.classList.remove("theme-anim"), 260);
  });

  try { localStorage.setItem(KEY, next ? "1" : "0"); } catch {}
  return next;
}
