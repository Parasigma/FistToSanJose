const $ = (id: string) => document.getElementById(id)!;

/** Por encima de esta marca del medidor, un celador cercano puede oírte. */
const UMBRAL = 0.32;

let notifyTimer: number | undefined;
let objTimer: number | undefined;
let clockH = 3;
let clockM = 47;
let clockTimer: number | undefined;

// icono píxel de la linterna (SVG embebido, sin assets externos)
const TORCH_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 15 15' shape-rendering='crispEdges'>` +
      `<rect x='0' y='6' width='1' height='1' fill='%23ffd98a'/>` +
      `<rect x='0' y='8' width='1' height='1' fill='%23ffd98a'/>` +
      `<rect x='1' y='7' width='1' height='1' fill='%23ffd98a'/>` +
      `<rect x='3' y='4' width='3' height='7' fill='%23cfc9b8'/>` +
      `<rect x='4' y='5' width='1' height='2' fill='%23fff6d8'/>` +
      `<rect x='6' y='5' width='1' height='5' fill='%238a8474'/>` +
      `<rect x='7' y='6' width='6' height='3' fill='%238a8474'/>` +
      `<rect x='7' y='6' width='6' height='1' fill='%23a49e8c'/>` +
      `<rect x='13' y='6' width='1' height='3' fill='%23524d42'/>` +
      `<rect x='10' y='6' width='1' height='3' fill='%23736d5e'/>` +
    `</svg>`
  );

function renderClock() {
  $("clock-h").textContent = String(clockH);
  $("clock-m").textContent = String(clockM).padStart(2, "0");
}

export const hud = {
  show() {
    $("hud").classList.remove("hidden");
    const ico = $("torch-ico") as HTMLImageElement;
    if (!ico.src) ico.src = TORCH_ICON;
    for (const seg of Array.from(document.querySelectorAll("#torch-segs .seg"))) {
      seg.classList.add("full");
    }
  },
  hide() {
    $("hud").classList.add("hidden");
  },
  objective(t: string) {
    $("obj-text").textContent = t;
    const o = $("objective");
    o.classList.toggle("hidden", !t);
    o.classList.remove("faded");
    window.clearTimeout(objTimer);
    if (t) objTimer = window.setTimeout(() => o.classList.add("faded"), 9000);
  },
  torch(on: boolean) {
    $("hud-torch").classList.toggle("hidden", !on);
  },
  /** Espectrómetro de ruido: nivel 0..1 y si te están oyendo. */
  noise(nivel: number, oido: boolean) {
    const wrap = $("hud-noise");
    if (wrap.classList.contains("hidden")) wrap.classList.remove("hidden");
    const n = Math.max(0, Math.min(1, nivel));
    const barras = document.querySelectorAll("#noise-bars i");
    barras.forEach((b, i) => {
      const activo = n > (i + 0.5) / barras.length;
      b.classList.toggle("on", activo);
      b.classList.toggle("over", activo && (i + 0.5) / barras.length >= UMBRAL);
    });
    wrap.classList.toggle("alert", oido);
  },
  hideNoise() {
    $("hud-noise").classList.add("hidden");
  },
  setLocation(t: string) {
    $("clock-loc").textContent = t;
  },
  startClock(h = 3, m = 47) {
    clockH = h;
    clockM = m;
    renderClock();
    window.clearInterval(clockTimer);
    clockTimer = window.setInterval(() => {
      clockM++;
      if (clockM >= 60) {
        clockM = 0;
        clockH = (clockH % 12) + 1;
      }
      renderClock();
    }, 60000);
  },
  clockText() {
    return `${clockH}:${String(clockM).padStart(2, "0")} AM`;
  },
  saveStamp(t: string) {
    $("save-stamp").textContent = t;
  },
  /** Sello discreto de autoguardado (arriba a la derecha, se desvanece). */
  autoSaved(motivo = "") {
    const el = $("autosave");
    el.textContent = motivo ? `GUARDADO · ${motivo}` : "GUARDADO";
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
  },
  prompt(t: string | null) {
    const el = $("prompt");
    if (!t) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = `<span class="key">[E]</span> `;
    el.appendChild(document.createTextNode(t));
  },
  notify(t: string, ms = 3000) {
    const el = $("notify");
    el.textContent = t;
    el.style.opacity = "1";
    window.clearTimeout(notifyTimer);
    // los avisos se leen a ritmo de lectura, no a ritmo de reloj: se da un
    // mínimo generoso y tiempo extra según lo largo que sea el texto
    const lectura = 2600 + t.length * 55;
    notifyTimer = window.setTimeout(() => (el.style.opacity = "0"), Math.max(ms, lectura));
  },
  fade(toBlack: boolean, ms = 1400): Promise<void> {
    const f = $("fade");
    f.style.transition = `opacity ${ms}ms ease`;
    f.style.opacity = toBlack ? "1" : "0";
    return new Promise((r) => setTimeout(r, ms + 80));
  },
  fadeInstant(toBlack: boolean) {
    const f = $("fade");
    f.style.transition = "none";
    f.style.opacity = toBlack ? "1" : "0";
    void f.offsetHeight;
    f.style.transition = "opacity 1.4s ease";
  },
};
