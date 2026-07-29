const $ = (id: string) => document.getElementById(id)!;

interface MapDef {
  rows: string[];
  zOff: number;
  off?: HTMLCanvasElement;
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
const npcs: { nivel: number; get: () => { x: number; z: number } | null }[] = [];

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
  return off;
}

export const minimap = {
  register(nivel: number, rows: string[], zOff: number) {
    maps.set(nivel, { rows, zOff });
  },

  trackNpc(nivel: number, get: () => { x: number; z: number } | null) {
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

    // el plano gira: la dirección de la marcha apunta hacia arriba
    const px = (x / 2) * OFF_SCALE;
    const py = ((z - def.zOff) / 2) * OFF_SCALE;
    ctx.translate(C, C);
    ctx.rotate(yaw + Math.PI);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(def.off, -px, -py);
    ctx.restore();

    // PNJs: puntos que giran con el plano (pegados al borde si quedan lejos)
    const th0 = yaw + Math.PI;
    const cosT = Math.cos(th0);
    const sinT = Math.sin(th0);
    for (const n of npcs) {
      if (n.nivel !== nivel) continue;
      const p = n.get();
      if (!p) continue;
      const mx = (p.x - x) * (OFF_SCALE / 2);
      const my = (p.z - z) * (OFF_SCALE / 2);
      const rx = mx * cosT - my * sinT;
      const ry = mx * sinT + my * cosT;
      // fuera del radio visible: el punto no se dibuja (nada de agolparse en el borde)
      if (Math.hypot(rx, ry) > R - 6) continue;
      ctx.fillStyle = "#0a0a0c";
      ctx.beginPath();
      ctx.arc(C + rx, C + ry, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c96a55";
      ctx.beginPath();
      ctx.arc(C + rx, C + ry, 2.8, 0, Math.PI * 2);
      ctx.fill();
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
    const th = yaw + Math.PI;
    const nx = C + Math.sin(th) * (R - 9);
    const ny = C - Math.cos(th) * (R - 9);
    ctx.fillStyle = "#cfc9b8";
    ctx.font = "bold 10px 'Courier New'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", nx, ny);
  },
};
