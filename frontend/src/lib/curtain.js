// frontend/src/lib/curtain.js
let node = null;
let killTimer = null;
let prevBodyOverflow = null;

function removeNode(immediate = false) {
  if (!node) return;

  const n = node;
  node = null;

  const cleanup = () => {
    if (n && n.parentNode) n.parentNode.removeChild(n);
    if (document && document.body) {
      document.body.classList.remove("kz-curtain-active");
      if (prevBodyOverflow !== null) {
        document.body.style.overflow = prevBodyOverflow;
        prevBodyOverflow = null;
      }
    }
  };

  if (immediate) {
    cleanup();
    return;
  }

  n.addEventListener("animationend", cleanup, { once: true });
}

export function startCurtain({ holdAt = 0.72, safetyMs = 6000 } = {}) {
  if (typeof document === "undefined") return;
  if (node) return;

  // Bloquea scroll del body mientras la cortina está activa
  prevBodyOverflow = document.body.style.overflow || "";
  document.body.style.overflow = "hidden";
  document.body.classList.add("kz-curtain-active");

  node = document.createElement("div");
  node.className = "kz-curtain";
  node.innerHTML = '<div class="kz-curtain__shape"></div>';
  document.body.appendChild(node);

  // entra
  requestAnimationFrame(() => node && node.classList.add("in"));

  // Safety: si por algo no hacemos finish, limpiamos en X ms
  clearTimeout(killTimer);
  killTimer = setTimeout(() => finishCurtain(), safetyMs);
}

export function finishCurtain() {
  clearTimeout(killTimer);
  killTimer = null;

  if (!node) {
    // Si existe en el DOM por alguna razón
    const stray = document.querySelector(".kz-curtain");
    if (stray) {
      stray.classList.remove("in");
      stray.classList.add("out");
      stray.addEventListener(
        "animationend",
        () => {
          if (stray.parentNode) stray.parentNode.removeChild(stray);
          document.body.classList.remove("kz-curtain-active");
          if (prevBodyOverflow !== null) {
            document.body.style.overflow = prevBodyOverflow;
            prevBodyOverflow = null;
          }
        },
        { once: true }
      );
    }
    return;
  }

  node.classList.remove("in");
  node.classList.add("out");
  removeNode(false);
}

// Útil al montar Login para asegurar que no quede nada pendiente
export function killCurtainImmediate() {
  clearTimeout(killTimer);
  killTimer = null;

  const stray = document.querySelector(".kz-curtain");
  if (stray && stray.parentNode) stray.parentNode.removeChild(stray);

  if (document && document.body) {
    document.body.classList.remove("kz-curtain-active");
    if (prevBodyOverflow !== null) {
      document.body.style.overflow = prevBodyOverflow;
      prevBodyOverflow = null;
    } else {
      // fallback
      document.body.style.overflow = "";
    }
  }
  node = null;
}
