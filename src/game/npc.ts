import {
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { colorMat } from "../core/textures";

export interface NPCOpts {
  name: string;
  position: Vector3;
  yaw: number;
  shirt: string;
  pants: string;
  skin: string;
  hair?: string;
  scale?: number;
  /** Descalzo (los pies van en color piel). */
  barefoot?: boolean;
  /** Gafas de pasta oscura. */
  glasses?: boolean;
  /** Pelo largo recogido: moño/coleta de hombre en la nuca. */
  ponytail?: boolean;
  /** Distancia a la que gira para mirar al jugador (por defecto 4.5). */
  faceRange?: number;
  /** La IA controla el giro (patrullas): el observer no toca el yaw. */
  manualYaw?: boolean;
}

export interface NPC {
  root: TransformNode;
  hit: Mesh;
  /** Activa/para la animación de andar (balanceo de piernas y brazos). */
  setMoving: (m: boolean) => void;
}

/** Cara pixelada 32x32 estilo PSX: inquietante por lo tosca. */
function faceTexture(scene: Scene, skin: string, name: string): DynamicTexture {
  const dt = new DynamicTexture("face_" + name, { width: 32, height: 32 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const ctx = dt.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 26, 32, 6);
  ctx.fillRect(7, 14, 5, 2);
  ctx.fillRect(20, 14, 5, 2);
  ctx.fillStyle = "#1a1512";
  ctx.fillRect(8, 10, 5, 4);
  ctx.fillRect(19, 10, 5, 4);
  ctx.fillStyle = "#e8e4da";
  ctx.fillRect(9, 11, 1, 1);
  ctx.fillRect(20, 11, 1, 1);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(8, 8, 6, 1);
  ctx.fillRect(18, 8, 6, 1);
  ctx.fillRect(15, 14, 2, 6);
  ctx.fillStyle = "#2a1c18";
  ctx.fillRect(11, 24, 10, 2);
  dt.update();
  return dt;
}

export function createNPC(scene: Scene, o: NPCOpts): NPC {
  const root = new TransformNode("npc_" + o.name, scene);
  root.position.copyFrom(o.position);
  root.rotation.y = o.yaw;
  const s = o.scale ?? 1;
  root.scaling.setAll(s);

  const mShirt = colorMat(scene, "m_shirt_" + o.name, o.shirt);
  const mPants = colorMat(scene, "m_pants_" + o.name, o.pants);
  const mSkin = colorMat(scene, "m_skin_" + o.name, o.skin);
  const mHair = colorMat(scene, "m_hair_" + o.name, o.hair ?? "#241a12");
  const mShoe = colorMat(scene, "m_shoe_" + o.name, "#1c1a18");

  const part = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: StandardMaterial) => {
    const m = MeshBuilder.CreateBox(name + "_" + o.name, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    m.material = mat;
    m.parent = root;
    return m;
  };

  const mFeet = o.barefoot ? mSkin : mShoe;
  const legL = part("legL", 0.22, 0.72, 0.24, -0.14, 0.42, 0, mPants);
  const legR = part("legR", 0.22, 0.72, 0.24, 0.14, 0.42, 0, mPants);
  const shoeL = part("shoeL", 0.24, 0.12, 0.34, -0.14, 0.06, 0.04, mFeet);
  const shoeR = part("shoeR", 0.24, 0.12, 0.34, 0.14, 0.06, 0.04, mFeet);
  shoeL.parent = legL;
  shoeL.position.set(0, -0.36, 0.04);
  shoeR.parent = legR;
  shoeR.position.set(0, -0.36, 0.04);
  const torso = part("torso", 0.58, 0.78, 0.32, 0, 1.17, 0, mShirt);
  const armL = part("armL", 0.16, 0.68, 0.2, -0.39, 1.12, 0, mShirt);
  const armR = part("armR", 0.16, 0.68, 0.2, 0.39, 1.12, 0, mShirt);
  part("handL", 0.14, 0.14, 0.16, -0.39, 0.72, 0, mSkin);
  part("handR", 0.14, 0.14, 0.16, 0.39, 0.72, 0, mSkin);
  const head = part("head", 0.34, 0.38, 0.32, 0, 1.78, 0, mSkin);
  const hair = MeshBuilder.CreateBox("hair_" + o.name, { width: 0.36, height: 0.12, depth: 0.34 }, scene);
  hair.position.set(0, 0.22, -0.02);
  hair.material = mHair;
  hair.parent = head;

  if (o.glasses) {
    const mGlass = colorMat(scene, "m_glass_" + o.name, "#15151a");
    const gPart = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const g = MeshBuilder.CreateBox("gafa_" + o.name, { width: w, height: h, depth: d }, scene);
      g.position.set(x, y, z);
      g.material = mGlass;
      g.parent = head;
      return g;
    };
    gPart(0.11, 0.09, 0.016, -0.075, 0.03, 0.175); // lente izda
    gPart(0.11, 0.09, 0.016, 0.075, 0.03, 0.175); // lente dcha
    gPart(0.05, 0.018, 0.016, 0, 0.05, 0.175); // puente
    gPart(0.016, 0.018, 0.17, -0.165, 0.05, 0.085); // patilla izda
    gPart(0.016, 0.018, 0.17, 0.165, 0.05, 0.085); // patilla dcha
  }

  if (o.ponytail) {
    const bun = MeshBuilder.CreateBox("mono_" + o.name, { width: 0.14, height: 0.12, depth: 0.12 }, scene);
    bun.position.set(0, 0.11, -0.2);
    bun.material = mHair;
    bun.parent = head;
    const tail = MeshBuilder.CreateBox("coleta_" + o.name, { width: 0.07, height: 0.18, depth: 0.06 }, scene);
    tail.position.set(0, -0.02, -0.21);
    tail.rotation.x = -0.15;
    tail.material = mHair;
    tail.parent = head;
  }

  const face = MeshBuilder.CreatePlane("faceP_" + o.name, { width: 0.3, height: 0.34, sideOrientation: Mesh.DOUBLESIDE }, scene);
  const fm = new StandardMaterial("m_face_" + o.name, scene);
  fm.diffuseTexture = faceTexture(scene, o.skin, o.name);
  fm.specularColor.set(0, 0, 0);
  fm.maxSimultaneousLights = 10;
  face.material = fm;
  face.position.set(0, 0, 0.165);
  face.parent = head;

  const hit = MeshBuilder.CreateBox("hit_" + o.name, { width: 0.85, height: 1.95, depth: 0.7 }, scene);
  hit.position.y = 0.975;
  hit.parent = root;
  hit.visibility = 0.001;
  hit.isPickable = true;
  hit.checkCollisions = true;

  const baseYaw = o.yaw;
  const faceRange = o.faceRange ?? 4.5;
  let t = Math.random() * 10;
  let moving = false;
  let wt = 0;
  scene.onBeforeRenderObservable.add(() => {
    const dts = scene.getEngine().getDeltaTime() / 1000;
    t += dts;
    torso.scaling.y = 1 + Math.sin(t * 1.7) * 0.015;
    head.rotation.y = Math.sin(t * 0.45) * 0.14;
    if (moving) {
      wt += dts * 9;
      const sw = Math.sin(wt) * 0.5;
      legL.rotation.x = sw;
      legR.rotation.x = -sw;
      armL.rotation.x = -sw * 0.65;
      armR.rotation.x = sw * 0.65;
    } else if (Math.abs(legL.rotation.x) > 0.01) {
      legL.rotation.x *= 0.82;
      legR.rotation.x *= 0.82;
      armL.rotation.x *= 0.82;
      armR.rotation.x *= 0.82;
    }
    if (o.manualYaw) return;
    const cam = scene.activeCamera;
    if (!cam) return;
    const dx = cam.position.x - root.position.x;
    const dz = cam.position.z - root.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const target = dist < faceRange ? Math.atan2(dx, dz) : baseYaw;
    let diff = target - root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    root.rotation.y += diff * 0.045;
  });

  return { root, hit, setMoving: (m: boolean) => (moving = m) };
}
