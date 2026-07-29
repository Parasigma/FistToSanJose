import {
  Color3,
  Mesh,
  MeshBuilder,
  MirrorTexture,
  Plane,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { Game } from "./Game";
import { createNPC, NPC } from "./npc";

/**
 * Espejos con reflexión real. El jugador no tiene cuerpo visible en primera
 * persona, así que se mantiene un "gemelo" con el aspecto de Mario que solo
 * existe durante el render del espejo: se coloca en la posición y la
 * orientación reales de la cámara, se agacha contigo y sostiene la linterna.
 */

let avatar: NPC | null = null;
let torch: Mesh | null = null;

function getAvatar(game: Game): NPC {
  if (avatar) return avatar;
  const scene = game.scene;
  avatar = createNPC(scene, {
    name: "MarioReflejo",
    position: new Vector3(0, -50, 0),
    yaw: 0,
    manualYaw: true,
    shirt: "#8a8d80", // pijama de paciente
    pants: "#4d5157",
    skin: "#c49a76",
    hair: "#2b2119", // injerto reciente, corto
    scale: 1.02,
  });
  avatar.hit.checkCollisions = false;
  avatar.hit.isPickable = false;
  avatar.hit.setEnabled(false);

  // un punto de luz propia: la silueta se lee incluso en un baño a oscuras
  for (const m of avatar.root.getChildMeshes()) {
    const mat = m.material as StandardMaterial | null;
    if (mat && mat.diffuseColor && mat.emissiveColor) {
      mat.emissiveColor = mat.diffuseColor.scale(0.26);
    }
  }

  // la linterna que se ve en su mano cuando la llevas encendida
  const t = MeshBuilder.CreateCylinder("reflejoTorch", { diameter: 0.055, height: 0.2, tessellation: 8 }, scene);
  const tm = new StandardMaterial("reflejoTorchM", scene);
  tm.diffuseColor = Color3.FromHexString("#26282c");
  tm.emissiveColor = new Color3(0.35, 0.32, 0.24);
  tm.specularColor = Color3.Black();
  t.material = tm;
  t.rotation.x = Math.PI / 2.4;
  t.position.set(0.4, 0.95, 0.26);
  t.parent = avatar.root;
  t.isPickable = false;
  torch = t;

  avatar.root.setEnabled(false);
  return avatar;
}

export interface MirrorOpts {
  /** El cristal. */
  mesh: Mesh;
  /** Hacia dónde mira la cara reflectante. */
  normal: Vector3;
  /** Geometría que debe verse reflejada (paredes, muebles cercanos...). */
  extra: Mesh[];
  /** Meshes que SOLO existen dentro del reflejo (no en la sala real). */
  ghosts?: Mesh[];
  /** Planta a la que pertenece (para no refrescar espejos de otros niveles). */
  nivel: number;
  /** Tinte del cristal (espejo viejo, sucio). */
  tint?: string;
  /** Resolución del reflejo (súbela si hay que leer algo dentro). */
  size?: number;
}

export function installMirror(game: Game, o: MirrorOpts) {
  const scene = game.scene;
  const av = getAvatar(game);
  const p = o.mesh.position;
  const n = o.normal.normalize();

  // resolución baja + sin filtrado: el reflejo hereda el grano PSX del resto
  const mt = new MirrorTexture("mirrorRT_" + o.mesh.name, o.size ?? 320, scene, true);
  mt.mirrorPlane = new Plane(-n.x, -n.y, -n.z, Vector3.Dot(n, p));
  const ghosts = o.ghosts ?? [];
  for (const g of ghosts) g.setEnabled(false);
  mt.renderList = [...o.extra, ...ghosts, ...(av.root.getChildMeshes() as Mesh[])];
  mt.level = 0.86;
  mt.adaptiveBlurKernel = 0;
  mt.wrapU = Texture.CLAMP_ADDRESSMODE;
  mt.wrapV = Texture.CLAMP_ADDRESSMODE;

  const mat = new StandardMaterial("mirrorM_" + o.mesh.name, scene);
  mat.reflectionTexture = mt;
  mat.diffuseColor = Color3.FromHexString(o.tint ?? "#171c1a");
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  mat.emissiveColor = new Color3(0.03, 0.035, 0.033);
  mat.maxSimultaneousLights = 10;
  o.mesh.material = mat;

  // los espejos "tienen luz propia": se realza el ambiente solo mientras se
  // pinta el reflejo, para que el cristal se lea aunque la sala esté a oscuras
  const hemi = scene.lights.find((l) => l.name === "hemi");
  let hemiPrev = 0;

  // el gemelo solo existe mientras se pinta el espejo
  mt.onBeforeRenderObservable.add(() => {
    if (hemi) {
      hemiPrev = hemi.intensity;
      hemi.intensity = 0.62;
    }
    const cam = game.player.camera;
    av.root.position.set(cam.position.x, 0, cam.position.z);
    av.root.rotation.y = cam.rotation.y;
    // agacharse: el cuerpo baja contigo
    const target = game.player.crouched ? 0.63 : 1;
    av.root.scaling.y += (target - av.root.scaling.y) * 0.35;
    if (torch) torch.setEnabled(game.player.flashOn);
    av.root.setEnabled(true);
    for (const g of ghosts) g.setEnabled(true);
  });
  mt.onAfterRenderObservable.add(() => {
    av.root.setEnabled(false);
    for (const g of ghosts) g.setEnabled(false);
    if (hemi) hemi.intensity = hemiPrev;
  });

  // solo se refresca si estás cerca y en la planta correcta
  mt.refreshRate = 0;
  let activo = false;
  game.onUpdate.push(() => {
    const enNivel = ((game.state.get("nivel") as number) ?? 1) === o.nivel;
    const cam = game.player.camera;
    const cerca = enNivel && Vector3.Distance(cam.position, p) < 9;
    if (cerca !== activo) {
      activo = cerca;
      mt.refreshRate = cerca ? 1 : 0;
    }
  });
}
