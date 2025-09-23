// frontend/src/lib/curtain.js
let node = null;

export function startCurtain({ holdAt = 0.72 } = {}) {
  if (typeof document === "undefined") return;
  if (node) return;

  node = document.createElement("div");
  node.className = "kz-curtain";
  node.innerHTML = '<div class="kz-curtain__shape"></div>';
  document.body.appendChild(node);

  requestAnimationFrame(() => node.classList.add("in"));
}

export function finishCurtain() {
  if (!node) node = document.querySelector(".kz-curtain");
  if (!node) return;

  node.classList.remove("in");
  node.classList.add("out");
  node.addEventListener(
    "animationend",
    () => {
      if (node && node.parentNode) node.parentNode.removeChild(node);
      node = null;
    },
    { once: true }
  );
}
