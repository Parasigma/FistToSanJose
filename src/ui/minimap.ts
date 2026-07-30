const $ = (id: string) => document.getElementById(id)!;

interface MapDef {
  rows: string[];
  zOff: number;
  off?: HTMLCanvasElement;
  rutas?: { x: number; z: number }[][];
}

/**
 * Minimapa rotatorio estilo brújula: viewport circular fijo, el plano gira
 * alrededor del jugador y "arriba" es siempre la dirección de la marcha.
 * El marcador queda clavado en el centro; la N del borde señala el norte.
 */
const maps = new Map<number, MapDef>();
const OFF_SCALE = 6; // px por tile en el plano cacheado
const SIZE = 160; // lado del lienzo del HUD
const R = SIZE / 2 - 4; // radio del viewport

/** PNJs visibles como puntos (los que acechan NO se registran aquí). */
const npcs: {
  nivel: number;
  get: () =>
    | {
        x: number;
        z: number;
        estado?: string;
        /** Orientación en el mundo: dibuja su cono de visión. */
        yaw?: number;
        /** Semiapertura del cono en radianes. */
        fov?: number;
        /** Alcance de visión en metros. */
        range?: number;
      }
    | null;
}[] = [];

const COLOR_ESTADO: Record<string, string> = {
  caza: "#e0442e",
  busca: "#ffd23a",
  sospecha: "#e8c86a",
};

function buildOffscreen(def: MapDef): HTMLCanvasElement {
  const cols = def.rows[0].length;
  const rows = def.rows.length;
  const off = document.createElement("canvas");
  off.width = cols * OFF_SCALE;
  off.height = rows * OFF_SCALE;
  const ctx = off.getContext("2d")!;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = def.rows[r][c];
      if (t === "#") {
        let near = false;
        for (let dr = -1; dr <= 1 && !near; dr++) {
          for (let dc = -1; dc <= 1 && !near; dc++) {
            if (def.rows[r + dr]?.[c + dc] === ".") near = true;
          }
        }
        if (!near) continue;
        ctx.fillStyle = "#7a7263";
        ctx.fillRect(c * OFF_SCALE, r * OFF_SCALE, OFF_SCALE, OFF_SCALE);
      } else if (t === ".") {
        ctx.fillStyle = "rgba(38,36,30,0.92)";
        ctx.fillRect(c * OFF_SCALE, r * OFF_SCALE, OFF_SCALE, OFF_SCALE);
      }
    }
  }
  // rondas de los celadores, punteadas
  if (def.rutas) {
    ctx.save();
    ctx.strokeStyle = "rgba(224,168,90,0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    for (const ruta of def.rutas) {
      if (ruta.length < 2) continue;
      ctx.beginPath();
      ruta.forEach((p, i) => {
        const px = (p.x / 2) * OFF_SCALE;
        const py = ((p.z - def.zOff) / 2) * OFF_SCALE;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
  return off;
}

export const minimap = {
  register(nivel: number, rows: string[], zOff: number) {
    maps.set(nivel, { rows, zOff });
  },

  /** Rondas conocidas: se dibujan punteadas bajo el plano. */
  registerRoutes(nivel: number, rutas: { x: number; z: number }[][]) {
    const def = maps.get(nivel);
    if (!def) return;
    def.rutas = rutas;
    def.off = undefined; // forzar redibujado del plano cacheado
  },

  trackNpc(nivel: number, get: () => { x: number; z: number; estado?: string } | null) {
    npcs.push({ nivel, get });
  },

  update(nivel: number, x: number, z: number, yaw: number, visible: boolean) {
    const wrap = $("mini-wrap");
    const def = maps.get(nivel);
    if (!visible || !def) {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    if (!def.off) def.off = buildOffscreen(def);

    const canvas = $("minimap") as HTMLCanvasElement;
    if (canvas.width !== SIZE) {
      canvas.width = SIZE;
      canvas.height = SIZE;
    }
    const ctx = canvas.getContext("2d")!;
    const C = SIZE / 2;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // viewport circular
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(6,6,8,0.62)";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // El plano gira con el jugador: lo que tiene delante va arriba y lo que
    // tiene a su derecha, a la derecha. El plano se guarda con +Z hacia abajo,
    // así que la transformación incluye el volteo vertical (determinante -1);
    // sin él, el mapa salía reflejado y la derecha aparecía a la izquierda.
    const px = (x / 2) * OFF_SCALE;
    const py = ((z - def.zOff) / 2) * OFF_SCALE;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    ctx.setTransform(cy, -sy, -sy, -cy, C, C);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(def.off, -px, -py);

    // conos de visión de los vigilantes, en el mismo sistema que el plano
    ctx.translate(-px, -py);
    for (const n of npcs) {
      if (n.nivel !== nivel) continue;
      const p = n.get();
      if (!p || p.yaw === undefined || !p.range) continue;
      const gx = (p.x / 2) * OFF_SCALE;
      const gy = ((p.z - def.zOff) / 2) * OFF_SCALE;
      const radio = (p.range / 2) * OFF_SCALE;
      const centro = Math.atan2(Math.cos(p.yaw), Math.sin(p.yaw));
      const media = p.fov ?? 0.7;
      const col =
        p.estado === "caza" ? "224,68,46" : p.estado === "busca" || p.estado === "sospecha" ? "255,210,58" : "232,200,106";
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radio);
      grad.addColorStop(0, `rgba(${col},0.42)`);
      grad.addColorStop(1, `rgba(${col},0.03)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.arc(gx, gy, radio, centro - media, centro + media);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(${col},0.5)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();

    // PNJs: mismos ejes que el plano (delante arriba, derecha a la derecha)
    const cosT = Math.cos(yaw);
    const sinT = Math.sin(yaw);
    for (const n of npcs) {
      if (n.nivel !== nivel) continue;
      const p = n.get();
      if (!p) continue;
      const mx = (p.x - x) * (OFF_SCALE / 2);
      const my = (p.z - z) * (OFF_SCALE / 2);
      const rx = mx * cosT - my * sinT;
      const ry = -mx * sinT - my * cosT;
      // fuera del radio visible: el punto no se dibuja (nada de agolparse en el borde)
      if (Math.hypot(rx, ry) > R - 6) continue;
      ctx.fillStyle = "#0a0a0c";
      ctx.beginPath();
      ctx.arc(C + rx, C + ry, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = (p.estado && COLOR_ESTADO[p.estado]) || "#c96a55";
      ctx.beginPath();
      ctx.arc(C + rx, C + ry, 3, 0, Math.PI * 2);
      ctx.fill();
      // los alterados laten para que se noten
      if (p.estado === "caza" || p.estado === "busca") {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 130);
        ctx.beginPath();
        ctx.arc(C + rx, C + ry, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // marcador fijo en el centro, mirando arriba
    ctx.fillStyle = "#ffd98a";
    ctx.beginPath();
    ctx.moveTo(C, C - 8);
    ctx.lineTo(C - 5, C + 5);
    ctx.lineTo(C, C + 2);
    ctx.lineTo(C + 5, C + 5);
    ctx.closePath();
    ctx.fill();

    // anillo y N de la brújula
    ctx.strokeStyle = "rgba(138,132,116,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(C, C, R, 0, Math.PI * 2);
    ctx.stroke();
    // el norte del mundo (+Z) con la misma transformación que el plano
    const nx = C - Math.sin(yaw) * (R - 9);
    const ny = C - Math.cos(yaw) * (R - 9);
    ctx.fillStyle = "#cfc9b8";
    ctx.font = "bold 10px 'Courier New'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", nx, ny);
  },
};
