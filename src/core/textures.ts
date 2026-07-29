import {
  Color3,
  DynamicTexture,
  Scene,
  StandardMaterial,
  Texture,
} from "@babylonjs/core";

export interface GrimeOpts {
  base: string;
  speckle?: number;
  stains?: number;
  tiles?: number;
  planks?: boolean;
  zocalo?: string;
}

/** Textura sucia procedural estilo PSX (256x256, sin filtrado). */
export function grimeTexture(scene: Scene, name: string, o: GrimeOpts): DynamicTexture {
  const size = 256;
  const dt = new DynamicTexture(name, { width: size, height: size }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;

  ctx.fillStyle = o.base;
  ctx.fillRect(0, 0, size, size);

  const speckles = o.speckle ?? 2600;
  for (let i = 0; i < speckles; i++) {
    ctx.fillStyle = Math.random() < 0.55 ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  for (let i = 0; i < (o.stains ?? 5); i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 18 + Math.random() * 60;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, "rgba(20,16,10,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  if (o.tiles) {
    const step = size / o.tiles;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 3;
    for (let i = 0; i <= o.tiles; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();
    }
  }

  if (o.planks) {
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    for (let x = 10; x < size; x += 30 + Math.random() * 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() * 8 - 4), size);
      ctx.stroke();
    }
  }

  if (o.zocalo) {
    ctx.fillStyle = o.zocalo;
    ctx.fillRect(0, size - 58, size, 58);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, size - 62, size, 4);
  }

  dt.update();
  return dt;
}

export function texMat(scene: Scene, name: string, tex: Texture, uScale = 1, vScale = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  tex.uScale = uScale;
  tex.vScale = vScale;
  m.diffuseTexture = tex;
  m.specularColor = Color3.Black();
  m.maxSimultaneousLights = 10;
  return m;
}

export function colorMat(scene: Scene, name: string, hex: string, emissive = 0): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = Color3.Black();
  m.maxSimultaneousLights = 10;
  if (emissive > 0) m.emissiveColor = m.diffuseColor.scale(emissive);
  return m;
}
