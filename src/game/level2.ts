import {
  Animation,
  Color3,
  Constants,
  DynamicTexture,
  EasingFunction,
  Effect,
  Mesh,
  MeshBuilder,
  Ray,
  ShaderMaterial,
  SineEase,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  Vector4,
} from "@babylonjs/core";
import { colorMat, grimeTexture, texMat } from "../core/textures";
import { hud } from "../ui/hud";
import { minimap } from "../ui/minimap";
import { Game } from "./Game";
import { buildItemModel } from "./models";
import { createNPC } from "./npc";

const T = 2;
const WALL_H = 3;
const Z_OFF = 60;

// Planta 1 — Archivo General. '#' muro, '.' suelo. 1 tile = 2m.
const MAP2 = [
  "##############################",
  "#.............##.............#",
  "#.............##.............#",
  "#.............##.............#",
  "#.............##.............#",
  "#.............##.............#",
  "#######.##############.#######",
  "#............................#",
  "#............................#",
  "#..#########.####.#########..#",
  "#..######............######..#",
  "#..######............######..#",
  "#..######............######..#",
  "#..######............######..#",
  "#..######............######..#",
  "#..######............######..#",
  "#..###########..###########..#",
  "#............#..#............#",
  "#............#..#............#",
  "#............#..#............#",
  "#............#..#............#",
  "##############################",
];

const cx = (c: number) => (c + 0.5) * T;
const cz = (r: number) => (r + 0.5) * T + Z_OFF;

export function buildLevel2(game: Game) {
  const scene = game.scene;
  const state = game.state;

  // ------------------------------------------------------------- materiales
  const matWall = texMat(scene, "wall2", grimeTexture(scene, "wallT2", { base: "#6b7066", stains: 10, zocalo: "#3d413a" }));
  const matFloor = texMat(
    scene,
    "floor2",
    grimeTexture(scene, "floorT2", { base: "#5d5a52", tiles: 2, speckle: 3800, stains: 10 }),
    MAP2[0].length,
    MAP2.length
  );
  const matCeil = texMat(
    scene,
    "ceil2",
    grimeTexture(scene, "ceilT2", { base: "#35342f", speckle: 2200, stains: 12 }),
    MAP2[0].length,
    MAP2.length
  );
  const matDoor = texMat(scene, "door2", grimeTexture(scene, "doorT2", { base: "#5a5148", planks: true, stains: 6 }));
  const matGate = texMat(scene, "gate2", grimeTexture(scene, "gateT2", { base: "#464b4e", speckle: 2400, stains: 8 }));
  const matFrame = colorMat(scene, "frame2", "#34362f");
  const matWood = texMat(scene, "wood2", grimeTexture(scene, "woodT2", { base: "#4e3f2c", planks: true, speckle: 1600 }));
  const matMetal = texMat(scene, "metal2", grimeTexture(scene, "metalT2", { base: "#6e7376", speckle: 1800, stains: 7 }));
  const matWhite = colorMat(scene, "white2", "#b2afa4");
  const matStone = texMat(scene, "stone2", grimeTexture(scene, "stoneT2", { base: "#55534c", speckle: 2600, stains: 9 }));
  const matDark = colorMat(scene, "dark2", "#232326");
  const matGlass = colorMat(scene, "glass2", "#9fb8c8");
  matGlass.alpha = 0.18;

  // ------------------------------------------------------------- geometría
  const boxes: Mesh[] = [];
  for (let r = 0; r < MAP2.length; r++) {
    for (let c = 0; c < MAP2[r].length; c++) {
      if (MAP2[r][c] !== "#") continue;
      let nearFloor = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (MAP2[r + dr]?.[c + dc] === ".") nearFloor = true;
        }
      }
      if (!nearFloor) continue;
      const b = MeshBuilder.CreateBox("w2", { width: T, height: WALL_H, depth: T }, scene);
      b.position.set(cx(c), WALL_H / 2, cz(r));
      boxes.push(b);
    }
  }
  const walls = Mesh.MergeMeshes(boxes, true, true)!;
  walls.name = "walls2";
  walls.material = matWall;
  walls.checkCollisions = true;
  walls.freezeWorldMatrix();
  minimap.register(2, MAP2, Z_OFF);

  const W = MAP2[0].length * T;
  const H = MAP2.length * T;
  const ground = MeshBuilder.CreateGround("ground2", { width: W, height: H }, scene);
  ground.position.set(W / 2, 0, Z_OFF + H / 2);
  ground.material = matFloor;
  ground.checkCollisions = true;

  const ceil = MeshBuilder.CreateGround("ceil2", { width: W, height: H }, scene);
  ceil.position.set(W / 2, WALL_H, Z_OFF + H / 2);
  ceil.rotation.x = Math.PI;
  ceil.material = matCeil;

  // ------------------------------------------------------------- helpers
  const box = (
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mt: StandardMaterial,
    opts?: { ry?: number; collide?: boolean }
  ) => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    if (opts?.ry) m.rotation.y = opts.ry;
    m.material = mt;
    m.checkCollisions = opts?.collide !== false;
    return m;
  };

  const sign = (text: string, x: number, y: number, z: number, faceRy: number, fg = "#cfc9b8", bg = "#20221f", w = 1.5) => {
    // textura del ancho justo del texto: nada de rótulos cortados
    const texW = Math.max(128, text.length * 23 + 40);
    const dt = new DynamicTexture("sg2_" + text, { width: texW, height: 64 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
    dt.drawText(text, null, 44, "bold 38px 'Courier New'", fg, bg, true);
    const m = new StandardMaterial("sgm2_" + text, scene);
    m.diffuseTexture = dt;
    m.emissiveTexture = dt;
    m.emissiveColor = new Color3(0.55, 0.55, 0.55);
    m.specularColor = Color3.Black();
    // DOUBLESIDE con la UV de la cara trasera invertida: el rótulo se lee
    // igual de bien por detrás en vez de salir escrito del revés
    const p = MeshBuilder.CreatePlane(
      "sgp2_" + text,
      {
        width: w,
        height: w * (64 / texW),
        sideOrientation: Mesh.DOUBLESIDE,
        frontUVs: new Vector4(0, 0, 1, 1),
        backUVs: new Vector4(1, 0, 0, 1),
      },
      scene
    );
    p.position.set(x, y, z);
    p.rotation.y = faceRy + Math.PI;
    p.material = m;
    return p;
  };

  const ease = new SineEase();
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
  const swing = (node: TransformNode, target: number) => {
    Animation.CreateAndStartAnimation("gw", node, "rotation.y", 60, 55, node.rotation.y, target, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
  };

  const makeDoor = (x: number, z: number, ry: number) => {
    const hinge = new TransformNode("hinge2", scene);
    hinge.position.set(x + Math.cos(ry) * -0.85, 0, z + Math.sin(ry) * 0.85);
    hinge.rotation.y = ry;
    const mesh = MeshBuilder.CreateBox("doorM2", { width: 1.7, height: 2.48, depth: 0.11 }, scene);
    mesh.position.set(0.85, 1.24, 0);
    mesh.material = matDoor;
    mesh.checkCollisions = true;
    mesh.parent = hinge;
    const knob = MeshBuilder.CreateBox("knob2", { width: 0.1, height: 0.1, depth: 0.26 }, scene);
    knob.position.set(1.5, 1.1, 0);
    knob.material = colorMat(scene, "knob2m" + x + z, "#c2a044", 0.15);
    knob.parent = hinge;
    box("f2L", 0.16, 2.6, 0.32, x + Math.cos(ry) * -0.95, 1.3, z + Math.sin(ry) * 0.95, matFrame);
    box("f2R", 0.16, 2.6, 0.32, x + Math.cos(ry) * 0.95, 1.3, z + Math.sin(ry) * -0.95, matFrame);
    const lin = box("f2T", 2.1, 0.55, 0.34, x, 2.76, z, matFrame);
    lin.rotation.y = ry;
    const door = {
      mesh,
      open: false,
      toggle() {
        door.open = !door.open;
        swing(hinge, door.open ? ry - 1.85 : ry);
        game.sfx.doorCreak();
      },
    };
    return door;
  };

  const lintelOnly = (x: number, z: number, wdt = 2.1) => {
    box("lint2", wdt, 0.55, 0.34, x, 2.76, z, matFrame);
  };

  // ------------------------------------------------------------- puertas y carteles
  const doorCocina = makeDoor(15, 73, 0);
  game.register(doorCocina.mesh, "doorCocina", () => (doorCocina.open ? "Cerrar la puerta" : "Abrir la puerta"), () => doorCocina.toggle());
  const doorDespacho = makeDoor(45, 73, 0);
  game.register(doorDespacho.mesh, "doorDespacho", () => (doorDespacho.open ? "Cerrar la puerta" : "Abrir la puerta"), () => doorDespacho.toggle());
  lintelOnly(25, 79);
  lintelOnly(35, 79);
  lintelOnly(4, 93, 4.3);
  lintelOnly(56, 93, 4.3);

  sign("COCINA · SALA 3", 15, 2.62, 74.06, 0, "#cfc9b8", "#20221f", 2.1);
  sign("DIRECCIÓN · SALA 1", 45, 2.62, 74.06, 0, "#d8e8f0", "#1d2a30", 2.3);
  sign("TERAPIA · SALA 2", 6, 2.62, 94.06, 0, "#cfc9b8", "#20221f", 2.1);
  sign("ALMACÉN · SALA 4", 54, 2.62, 94.06, 0, "#cfc9b8", "#20221f", 2.1);
  sign("ESCALERA — P2", 57.92, 2.62, 75, -Math.PI / 2, "#9fe89f", "#0d2010", 1.8);

  // escalera por la que bajas: cerrada a tu espalda
  const doorEsc = makeDoor(57.9, 75, Math.PI / 2);
  game.register(doorEsc.mesh, "doorEsc2", "Subir a la planta 2", () => {
    game.sfx.doorCreak();
    game.enterLevel1?.();
  });

  // ------------------------------------------------------------- cocina
  box("encimera", 8, 0.9, 0.8, 8, 0.45, 61.6, matMetal);
  box("fogones", 1.4, 0.12, 0.7, 11, 0.96, 61.6, matDark, { collide: false });
  box("mesaCocina", 2.2, 0.78, 1.2, 8, 0.39, 67, matWood);
  box("fregadero", 1.2, 0.5, 0.6, 3.5, 1.0, 61.7, matWhite, { collide: false });
  const fog = box("fogonesI", 1.4, 0.05, 0.7, 11, 1.05, 61.6, matDark, { collide: false });
  game.register(fog, "fogones", "Mirar los fogones", () => {
    game.notify("Fríos. Nadie cocina aquí desde el incidente del dürüm. Hay una silueta quemada con forma de kebab.");
  });

  const neveraL2 = box("neveraL2", 0.8, 1.6, 0.75, 3, 0.8, 63.5, matWhite);
  game.register(neveraL2, "neveraL2", () => (!state.has("yogur_pina") && !state.get("of_yogur") ? "Abrir la nevera" : "Mirar la nevera"), () => {
    if (!state.has("yogur_pina") && !state.get("of_yogur")) {
      state.addItem({ id: "yogur_pina", name: "Yogur de piña", desc: "En la tapa, rotulador rojo: «PARA ISMAEL. NO.» No especifica no qué. Solo NO." });
      game.sfx.pickup();
      game.notify("Has cogido un yogur de piña. En esta planta lo racionan.");
      updateObjective2();
    } else {
      game.notify("Vacía. Una nota dentro: «EL YOGUR SE RACIONA. FIRMADO: EL DIRECTOR.»");
    }
  });

  // ------------------------------------------------------------- despacho (vitrina del casco)
  box("escrit2", 1.9, 0.8, 0.9, 45, 0.4, 64.5, matWood);
  // el plano de esta planta, sobre el escritorio del Director
  if (!state.has("mapa2")) {
    const mapa2M = box("mapa2", 0.36, 0.015, 0.28, 45.6, 0.82, 64.3, colorMat(scene, "mapa2P", "#d6d0be", 0.12), { collide: false });
    mapa2M.rotation.y = -0.3;
    game.register(mapa2M, "mapa2", "Coger el plano de la planta 1", () => {
      state.addItem({
        id: "mapa2",
        name: "Plano — Planta 1 · Admisiones",
        desc: "El plano de la planta 1, del cajón del Director. Alguien ha rodeado el almacén con rotulador rojo. Sin explicación.",
      });
      mapa2M.dispose();
      game.sfx.pickup();
      game.notify("Has cogido el plano de la planta 1. Vuelve a haber mapa arriba a la derecha.");
    });
  }
  box("sillaDir", 0.55, 1.1, 0.55, 45, 0.55, 63.3, matWood);
  box("estantDir", 0.5, 2.3, 3.2, 57.4, 1.15, 67, matWood);
  const cuadro = box("cuadroDir", 1.3, 1.6, 0.06, 50, 1.7, 62.15, matDark, { collide: false });
  game.register(cuadro, "cuadroDir", "Mirar el retrato", () => {
    game.talk(
      {
        c1: {
          speaker: "RETRATO",
          text: "Un marco dorado enorme. Dentro, un retrato completamente negro.\nLa placa: «EL DIRECTOR».\n\nCuanto más lo miras, más seguro estás de que el negro te mira antes.",
        },
      },
      "c1"
    );
  });

  if (!state.has("casco_romano") && !state.get("of_casco")) {
    const ped = box("pedCasco", 0.6, 1.0, 0.6, 45, 0.5, 67.5, matStone);
    const cascoM = buildItemModel(scene, "casco_romano")!;
    cascoM.position.set(45, 1.3, 67.5);
    let glass: Mesh | null = null;
    if (!state.get("vitrina_rota")) {
      glass = box("vitrinaCasco", 0.55, 0.55, 0.55, 45, 1.35, 67.5, matGlass, { collide: false });
      glass.isPickable = false;
    }
    const meshes = [ped, ...cascoM.getChildMeshes()];
    game.register(
      meshes as Mesh[],
      "cascoTake",
      () => (state.get("vitrina_rota") ? "Coger el casco romano" : "Vitrina — cristal intacto"),
      () => {
        if (!state.get("vitrina_rota")) {
          state.set("vio_vitrina");
          if (state.has("martillo")) {
            state.set("vitrina_rota");
            glass?.dispose();
            game.sfx.glass();
            game.notify("El martillo hace su único truco. El cristal se rinde a la primera.");
          } else {
            game.sfx.locked();
            game.notify("Cristal grueso, de los de verdad. A mano solo romperías la mano. Necesitas una herramienta.");
          }
          return;
        }
        state.addItem({ id: "casco_romano", name: "Casco romano de Mario", desc: "«Auténtico legionario», según Mario. Pone SPQR con rotulador. Talla única: la suya." });
        cascoM.dispose();
        game.unregister("cascoTake");
        game.sfx.pickup();
        game.notify("Has cogido el casco romano entre los cristales.");
        updateObjective2();
      }
    );
  }

  // ------------------------------------------------------------- terapia (cubo del pelo)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    box("sillaTer" + i, 0.5, 0.9, 0.5, 9 + Math.cos(a) * 2.4, 0.45, 98 + Math.sin(a) * 2.4, matWood, { ry: -a + Math.PI / 2 });
  }
  const pizarra = box("pizarra", 2.6, 1.4, 0.08, 10, 1.7, 101.85, matDark, { collide: false });
  game.register(pizarra, "pizarra", "Leer la pizarra", () => {
    game.notify("«TERAPIA DE HOY: LA ACEPTACIÓN.» Debajo, con otra letra: «de que no hay yogur para todos».");
  });

  // el cubo del pelo está escondido TRAS EL ARMARIO (nota cifrada del mostrador)
  const armarioT = box("armarioTer", 1.4, 2.2, 0.65, 4.2, 1.1, 101.35, matWood);
  if (state.get("armario_movido")) armarioT.position.x = 5.9;

  const revelarCubo = () => {
    if (state.has("cubo_pelo") || state.get("of_pelo")) return;
    box("repisaPelo", 0.7, 0.08, 0.5, 4.2, 0.55, 101.5, matWood, { collide: false });
    const cuboM = buildItemModel(scene, "cubo_pelo")!;
    cuboM.position.set(4.2, 0.85, 101.5);
    game.register(cuboM.getChildMeshes() as Mesh[], "peloTake", "Coger el cubo de metacrilato", () => {
      state.addItem({ id: "cubo_pelo", name: "El último pelo vivo de Victor", desc: "Un pelo solitario en un cubo de metacrilato. La placa: «V.L.T. — In memoriam del resto»." });
      cuboM.dispose();
      game.unregister("peloTake");
      game.sfx.pickup();
      game.notify("Has cogido el último pelo vivo de Victor. Pesa más de lo que debería.");
      updateObjective2();
    });
  };
  if (state.get("armario_movido")) revelarCubo();

  game.register(
    armarioT,
    "armarioTer",
    () => (state.get("armario_movido") ? "Armario" : state.get("nota_cifrada") ? "Mover el armario" : "Armario viejo"),
    () => {
      if (state.get("armario_movido")) {
        game.notify("Ya no esconde nada más. Probablemente.");
        return;
      }
      if (!state.get("nota_cifrada")) {
        game.notify("Un armario enorme que no pinta nada en una sala de terapia. Pesa una tonelada y no tienes motivo para moverlo.");
        return;
      }
      state.set("armario_movido");
      Animation.CreateAndStartAnimation("armSlide", armarioT, "position.x", 60, 80, armarioT.position.x, 5.9, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
      game.sfx.doorCreak();
      game.notify("TRAS... EL... ARMARIO. Lo arrastras. Detrás, un hueco excavado en la pared.");
      revelarCubo();
      updateObjective2();
    }
  );

  // ------------------------------------------------------------- almacén
  box("cajas1", 1.2, 1.2, 1.2, 38, 0.6, 100, matWood);
  box("cajas2", 0.9, 0.9, 0.9, 38.2, 1.65, 100, matWood);
  box("cajas3", 1.4, 0.8, 1.1, 44, 0.4, 96, matWood);
  box("estAlm", 0.5, 2.2, 4.0, 57.4, 1.1, 98, matMetal);
  const archv = box("archivador", 1.6, 1.5, 0.6, 52, 0.75, 101.5, matMetal);
  game.register(archv, "archivador", "Abrir el archivador", () => {
    game.notify("Cajones vacíos con etiquetas: A–F, G–M, N–R... La de la S–Z está arrancada de cuajo.");
  });

  // interruptor del almacén: la pintura forense solo destaca a oscuras
  // en la pared que flanquea la entrada (el muro acaba en x=54), no en el vano
  const interruptor = box("interruptorAlm", 0.16, 0.24, 0.07, 53.4, 1.4, 94.1, matDark, { collide: false });
  const palanca = box("palancaAlm", 0.05, 0.1, 0.05, 53.4, 1.4, 94.15, colorMat(scene, "palancaM", "#b8b2a0", 0.2), { collide: false });
  game.register(
    [interruptor, palanca],
    "interruptorAlm",
    () => (state.get("luz_almacen_off") ? "Encender la luz del almacén" : "Apagar la luz del almacén"),
    () => {
      const off = !state.get("luz_almacen_off");
      state.set("luz_almacen_off", off);
      const l = game.levelLights[6];
      if (l) l.intensity = off ? 0 : 0.45;
      game.sfx.switchClick();
      game.notify(off ? "Clac. La oscuridad se traga el almacén." : "La luz vuelve. De mala gana.");
    }
  );

  // la baldosa del martillo: pintura forense en el suelo. La equis está ahí
  // SIEMPRE, pero solo es visible dentro del círculo directo de la linterna
  // (recortada por el cono de luz, por píxel) y con el almacén a oscuras.
  if (!state.has("martillo")) {
    const xTex = new DynamicTexture("uvXT", { width: 128, height: 128 }, scene, false, Texture.BILINEAR_SAMPLINGMODE);
    const xc = xTex.getContext() as unknown as CanvasRenderingContext2D;
    xc.clearRect(0, 0, 128, 128);
    xc.strokeStyle = "#c9a2ff";
    xc.lineWidth = 13;
    xc.lineCap = "round";
    xc.shadowColor = "#8a5cff";
    xc.shadowBlur = 14;
    xc.beginPath();
    xc.moveTo(26, 26);
    xc.lineTo(102, 102);
    xc.moveTo(102, 26);
    xc.lineTo(26, 102);
    xc.stroke();
    xTex.update();
    xTex.hasAlpha = true;

    Effect.ShadersStore["uvxVertexShader"] = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 world;
      uniform mat4 worldViewProjection;
      varying vec3 vPositionW;
      varying vec2 vUV;
      void main(void) {
        vec4 wp = world * vec4(position, 1.0);
        vPositionW = wp.xyz;
        vUV = uv;
        gl_Position = worldViewProjection * vec4(position, 1.0);
      }`;
    Effect.ShadersStore["uvxFragmentShader"] = `
      precision highp float;
      varying vec3 vPositionW;
      varying vec2 vUV;
      uniform sampler2D xTex;
      uniform vec3 lightPos;
      uniform vec3 lightDir;
      uniform float cosAngle;
      uniform float range;
      uniform float lightOn;
      uniform float roomLit;
      uniform float time;
      void main(void) {
        vec4 tex = texture2D(xTex, vUV);
        vec3 toFrag = vPositionW - lightPos;
        float dist = length(toFrag);
        float cosA = dot(toFrag / dist, lightDir);
        float cone = smoothstep(cosAngle - 0.05, cosAngle + 0.05, cosA);
        float att = clamp(1.0 - dist / range, 0.0, 1.0);
        float glow = lightOn * cone * smoothstep(0.03, 0.45, att);
        glow *= mix(1.0, 0.05, roomLit);
        glow *= 0.88 + 0.12 * sin(time * 6.3 + vUV.x * 9.0);
        float a = tex.a * glow;
        if (a < 0.012) discard;
        gl_FragColor = vec4(tex.rgb * (0.35 + 0.85 * glow), a);
      }`;

    const xMat = new ShaderMaterial("uvXm", scene, "uvx", {
      attributes: ["position", "uv"],
      uniforms: ["world", "worldViewProjection", "lightPos", "lightDir", "cosAngle", "range", "lightOn", "roomLit", "time"],
      samplers: ["xTex"],
      needAlphaBlending: true,
    });
    xMat.setTexture("xTex", xTex);
    xMat.alphaMode = Constants.ALPHA_ADD;
    xMat.backFaceCulling = false;

    const xPlane = MeshBuilder.CreatePlane("uvXp", { size: 0.55 }, scene);
    xPlane.rotation.x = Math.PI / 2;
    xPlane.position.set(47.5, 0.02, 100.5);
    xPlane.material = xMat;

    let uvT = 0;
    let iluminada = false;
    game.onUpdate.push((dt) => {
      if (state.get("nivel") !== 2 || xPlane.isDisposed()) return;
      uvT += dt;
      const cam = game.player.camera;
      const spot = game.player.spotLight;
      const luzAlm = game.levelLights[6];
      const roomLit = luzAlm && luzAlm.intensity > 0.05 ? 1 : 0;
      xMat.setVector3("lightPos", spot.getAbsolutePosition());
      xMat.setVector3("lightDir", Vector3.TransformNormal(spot.direction, cam.getWorldMatrix()).normalize());
      xMat.setFloat("cosAngle", Math.cos(spot.angle * 0.42));
      xMat.setFloat("range", 7.5);
      xMat.setFloat("lightOn", game.player.flashOn ? Math.min(1, spot.intensity / 1.9) : 0);
      xMat.setFloat("roomLit", roomLit);
      xMat.setFloat("time", uvT);
      const hacia = xPlane.position.subtract(cam.position);
      const dist = hacia.length();
      hacia.normalize();
      const fwd = cam.getDirection(Vector3.Forward()).normalize();
      iluminada = game.player.flashOn && roomLit === 0 && dist < 4.5 && Vector3.Dot(fwd, hacia) > 0.55;
      if (iluminada && !state.get("uv_vista")) state.set("uv_vista");
    });

    game.register(
      xPlane,
      "baldosaUV",
      "Levantar la baldosa marcada",
      () => {
        xPlane.dispose();
        box("huecoBaldosa", 0.6, 0.012, 0.6, 47.5, 0.007, 100.5, colorMat(scene, "huecoM", "#141412"), { collide: false });
        state.addItem({ id: "martillo", name: "Martillo de mantenimiento", desc: "Mango gastado, cabeza fiel. Estaba bajo la baldosa marcada con pintura que solo tu linterna sabe ver." });
        game.sfx.pickup();
        game.notify("Bajo la equis, una baldosa pequeña. Debajo, envuelto en un trapo: un martillo.");
      },
      () => iluminada
    );
  }

  // ------------------------------------------------------------- hall y altar
  box("mostrador", 3.2, 1.1, 0.9, 30, 0.55, 82.5, matWood);
  // nota cifrada: trece palabras inconexas; el acróstico dice TRAS EL ARMARIO
  const matPaper2 = colorMat(scene, "paper2", "#d6d0be", 0.12);
  const notaMart = box("notaCifrada", 0.3, 0.012, 0.38, 29.2, 1.11, 82.35, matPaper2, { collide: false });
  notaMart.rotation.y = 0.35;
  game.register(notaMart, "notaCifrada", "Leer la nota del mostrador", () => {
    state.set("nota_cifrada");
    game.talk(
      {
        m1: {
          speaker: "NOTA CIFRADA",
          text: "«Tijeras. Ruido. Alfombra. Sopa.\nEspejo. Luna.\nAlmohada. Reloj. Manta. Aguja. Radio. Insomnio. Olvido.»",
          next: "m2",
        },
        m2: {
          text: "(Trece palabras que no vienen a cuento.\nY un detalle: alguien ha repasado con fuerza\nla primera letra de cada una.)",
        },
      },
      "m1"
    );
  });
  const campana = box("campanilla", 0.16, 0.14, 0.16, 30.8, 1.18, 82.4, colorMat(scene, "campM", "#c2a044", 0.2), { collide: false });
  game.register(campana, "campanilla", "Tocar la campanilla", () => {
    game.sfx.distant();
    game.notify("Din. El sonido baja por el suelo, muy lejos... y algo, muy abajo, contesta.");
  });
  box("banco1", 2.2, 0.5, 0.7, 22, 0.25, 81.5, matWood);
  box("banco2", 2.2, 0.5, 0.7, 38, 0.25, 81.5, matWood);
  sign("ADMISIONES", 30, 2.62, 80.2, Math.PI, "#cfc9b8", "#20221f", 2.0);

  // portón del Archivo (dos hojas)
  const mkLeaf = (hx: number, dir: 1 | -1) => {
    const hinge = new TransformNode("gateH" + dir, scene);
    hinge.position.set(hx, 0, 93);
    const m = MeshBuilder.CreateBox("gateLeaf" + dir, { width: 1.85, height: 2.85, depth: 0.14 }, scene);
    m.position.set(0.925 * dir, 1.425, 0);
    m.material = matGate;
    m.checkCollisions = true;
    m.parent = hinge;
    return { hinge, m };
  };
  const leafL = mkLeaf(28.15, 1);
  const leafR = mkLeaf(31.85, -1);
  box("gPostL", 0.2, 3, 0.5, 27.95, 1.5, 93, matFrame);
  box("gPostR", 0.2, 3, 0.5, 32.05, 1.5, 93, matFrame);
  box("gLint", 4.4, 0.4, 0.5, 30, 2.88, 93, matFrame);
  sign("ARCHIVO — SOLO PERSONAL", 30, 2.55, 91.9, Math.PI, "#d6b96a", "#241d10", 3.0);

  const openGateNow = (silent: boolean) => {
    if (silent) {
      leafL.hinge.rotation.y = -1.8;
      leafR.hinge.rotation.y = 1.8;
    } else {
      swing(leafL.hinge, -1.8);
      swing(leafR.hinge, 1.8);
      game.sfx.unlock();
      game.sfx.doorCreak();
      setTimeout(() => game.sfx.distant(), 700);
    }
  };
  if (state.get("archivo_abierto")) openGateNow(true);

  game.register([leafL.m, leafR.m], "gate", "Portón del Archivo", () => {
    if (state.get("archivo_abierto")) return;
    game.sfx.locked();
    state.set("vio_altar");
    updateObjective2();
    game.notify("Ni se inmuta. Junto al portón, tres hornacinas vacías esperan algo.");
  });

  // altar: tres hornacinas
  const countPlaced = () => ["of_yogur", "of_casco", "of_pelo"].filter((f) => state.get(f)).length;
  const sockets = [
    { x: 20.5, item: "yogur_pina", flag: "of_yogur", placa: "LA MERIENDA", nombre: "el yogur de piña" },
    { x: 23.5, item: "casco_romano", flag: "of_casco", placa: "EL IMPERIO", nombre: "el casco romano" },
    { x: 26.5, item: "cubo_pelo", flag: "of_pelo", placa: "LA ÚLTIMA ESPERANZA", nombre: "el pelo de Victor" },
  ];
  for (const s of sockets) {
    const ped = box("hornacina_" + s.item, 0.55, 1.05, 0.55, s.x, 0.52, 91.5, matStone);
    sign(s.placa, s.x, 1.85, 91.9, Math.PI, "#d6b96a", "#241d10", 1.15);
    const spawnPlaced = () => {
      const mdl = buildItemModel(scene, s.item)!;
      mdl.position.set(s.x, 1.28, 91.5);
    };
    if (state.get(s.flag)) spawnPlaced();
    game.register(ped, "socket_" + s.item, () => (state.get(s.flag) ? "Ofrenda colocada" : `Hornacina — «${s.placa}»`), () => {
      if (state.get(s.flag)) {
        game.notify("Ya está en su sitio. Mejor no tocarlo.");
        return;
      }
      state.set("vio_altar");
      if (state.has(s.item)) {
        state.removeItem(s.item);
        state.set(s.flag);
        spawnPlaced();
        game.sfx.place();
        const n = countPlaced();
        game.notify(`Colocas ${s.nombre}. (${n}/3)`);
        updateObjective2();
        if (n === 3) {
          state.set("archivo_abierto");
          setTimeout(() => {
            openGateNow(false);
            game.notify("Algo enorme se destraba dentro de la pared.");
            updateObjective2();
          }, 900);
        }
      } else {
        game.sfx.locked();
        game.notify(`La placa dice: «${s.placa}». La hornacina espera ${s.nombre}.`);
        updateObjective2();
      }
    });
  }

  // ------------------------------------------------------------- objetivos
  const updateObjective2 = () => {
    if (state.get("nivel") !== 2) return;
    if (state.get("archivo_abierto")) return game.setObjective("El portón del Archivo está abierto.\nEntra.");
    if (state.get("vio_altar"))
      return game.setObjective(
        `Reúne las tres ofrendas del altar (${countPlaced()}/3):\n— el yogur de piña\n— el casco romano de Mario\n— el último pelo vivo de Victor`
      );
    game.setObjective("Planta 1.\nEncuentra la entrada al Archivo.");
  };

  // ------------------------------------------------------------- final del episodio
  // cruzar la antesala del portón = bajar al Archivo (nivel 3)
  game.onUpdate.push(() => {
    if (state.get("nivel") !== 2 || game.ended || !game.playing || game.modal) return;
    const p = game.player.camera.position;
    if (state.get("archivo_abierto") && p.z > 95.5 && p.x > 27 && p.x < 33) {
      game.enterLevel3?.();
    }
  });

  // ------------------------------------------------------------- NIKUMAN, el que aparece
  const nik = createNPC(scene, {
    name: "Nikuman2",
    position: new Vector3(0, -20, 0),
    yaw: 0,
    shirt: "#7d8a7b",
    pants: "#6d6a5f",
    skin: "#c29a78",
    hair: "#4a3a2a",
    scale: 0.97,
    barefoot: true,
    glasses: true,
    faceRange: 40, // siempre girado hacia ti mientras está aparecido
  });
  nik.root.setEnabled(false);
  nik.hit.checkCollisions = false; // no hace nada: solo asusta

  // Frases distintas según dónde te lo encuentres: en Admisiones (planta 1)
  // y en el ALA C, donde el contexto es el sigilo y los celadores.
  const lineasP1 = [
    "¿Qué? Ando descalzo. No hago ruido.\nEso no es acercarse en plan raro. Es ahorro de suela.",
    "¿Te he asustado? Elizabeth dice que tengo cara de susto.\nDe dar, no de tener. Luego se ríe. Nadie más se ríe.",
    "Shhh. Estoy contando tus pasos.\nLlevas cuatro mil quinientos doce desde ayer. Malos, la mayoría.",
    "¿Que cómo he bajado antes que tú?\nYo no he bajado. Tú has subido. Piénsalo.\nO mejor no lo pienses.",
    "Aquí abajo racionan el yogur.\nSi ves uno de piña, ni lo mires.\nEs MÍO. Legalmente mío.",
    "La Mano Negra baja por las noches a firmar cosas.\nYo bajo antes. Para pillarle el sitio.",
    "No mires el altar mucho rato.\nAl altar le gusta que lo miren.\nY luego pide más.",
    "¿Lo mejor de esta planta? El eco.\nECO. Eco. eco.\n¿Ves? Nunca falla.",
    "Estoy haciendo QT. Tiempo de calidad conmigo mismo.\nEl único que no me lo cancela.",
    "El brujo número uno del PoE no se pierde.\nEstá... explorando rutas alternativas.",
    "El de mantenimiento marcaba sus escondites\ncon pintura de esa que no se ve.\nApaga su luz. Enciende la tuya. En ese orden.",
    "Mi hermano Cauntu me prometió visión nocturna\npara el Niku-Borg 9000.\nAsí YO nunca necesitaré linterna. Tú sigue con la tuya, MM.",
  ];
  const lineasAlaC = [
    "A mí los celadores no me ven.\nNo es sigilo. Es que han decidido que no merezco la ronda.\nDuele, pero se agradece.",
    "GUZMÁN huele a tabaco frío.\nCuando el pasillo huela a eso, ya lo tienes encima.\nDe nada, MM.",
    "Los armarios de aquí son mejores que mi habitación.\nMás anchos. Más limpios.\nHe dormido en cuatro. Los tengo puntuados.",
    "Si te agachas dejas de sonar.\nSi corres, suenas como un carro de bandejas.\nElige tú, que aquí el que corre eres tú.",
    "Esa puerta de arriba da a la azotea.\nDicen que desde allí se ve el ala que no existe.\nYo no he mirado. Yo qué sé. Yo no miro.",
    "Cuenta las camas del dormitorio.\nAhora cuenta a los que duermen.\nNo cuadra, ¿verdad? Pues eso llevo yo tres años.",
    "Antes esto era la planta de los ruidosos.\nAhora es la planta de los silenciosos.\nMismos internos. Nadie se ha ido.",
    "Yo aquí no me escondo.\n¿Para qué? Si me pillan, me llevan a mi cuarto.\nA ti te llevan a otro sitio.",
    "El de la tarjeta roja se cree que nadie mira su bolsillo.\nYo miro TODOS los bolsillos.\nEs lo único que me queda por hacer.",
    "Shhh. Viene alguien.\n(...)\nMentira. Pero mírate la cara. Impagable.",
  ];
  const lineasAzotea = [
    "Aire. ¿Lo notas?\nYo llevo tres años sin notarlo y ahora no sé qué hacer con él.",
    "Desde aquí se ve el pueblo.\nLas luces. La gente durmiendo con la puerta sin llave.\nQué morro.",
    "No mires abajo desde el pretil.\nMira ARRIBA. Siempre hay otra azotea.\nEse es el chiste del edificio.",
    "Los extractores estos me quitaron el sueño dos años.\nAhora que están parados... no puedo dormir.\nNo hay manera conmigo.",
    "Cuidado con el depósito.\nCuatro mil litros esperando un motivo.",
    "Aquí arriba no hay celadores.\n¿Y sabes por qué? Porque de aquí no se escapa nadie.\nEso dicen ellos. Míralos.",
    "El de mantenimiento se llamaba F.\nDejaba notas por todas partes.\nUn día dejó de dejarlas. Fin de la historia.",
    "¿La escalera? Plegada desde antes de que yo entrara.\nComo todo lo que sube.",
    "Si subes ahí arriba y encuentras algo mío,\nno lo leas.\nNo lo leas, MM. Lo digo en serio.",
  ];
  let bolsa: number[] = [];
  let bolsaNivel = -1;
  const frase = () => {
    const nv = (state.get("nivel") as number) ?? 1;
    const set = nv === 5 ? lineasAzotea : nv === 4 ? lineasAlaC : lineasP1;
    if (!bolsa.length || bolsaNivel !== nv) {
      bolsaNivel = nv;
      bolsa = set.map((_, i) => i).sort(() => Math.random() - 0.5);
    }
    return set[bolsa.pop()! % set.length];
  };
  game.register(nik.hit, "npcNikuman2", "Hablar con Nikuman", () =>
    game.talk({ s: { speaker: "NIKUMAN", text: frase() } }, "s")
  );

  /**
   * Sitios donde puede plantarse "al doblar la esquina", calculados en vivo:
   * direcciones fuera de tu campo de visión con hueco libre. Así funciona en
   * cualquier planta sin listas de coordenadas a mano.
   */
  const buscarEsquinas = (fwd: Vector3): Vector3[] => {
    const cam = game.player.camera;
    const salida: Vector3[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dir = new Vector3(Math.sin(a), 0, Math.cos(a));
      if (Vector3.Dot(fwd, dir) > 0.15) continue; // debe quedar fuera de tu vista
      const dist = 6 + Math.random() * 2.5;
      const origen = new Vector3(cam.position.x, 1.2, cam.position.z);
      const ray = new Ray(origen, dir, dist + 0.8);
      const hit = scene.pickWithRay(ray, (m) => m.checkCollisions && m.isEnabled());
      if (hit?.hit) continue; // hay pared antes: ahí no cabe
      salida.push(new Vector3(cam.position.x + dir.x * dist, 0, cam.position.z + dir.z * dist));
    }
    return salida;
  };

  let activo = false;
  let asustado = false;
  let activoDesde = 0;
  let siguiente = 0;
  let iniciado = false;

  const aparecer = (pos: Vector3) => {
    nik.root.position.set(pos.x, 0, pos.z);
    // aparece ya girado hacia el jugador: te mira antes de que tú lo mires
    const cam = game.player.camera;
    nik.root.rotation.y = Math.atan2(cam.position.x - pos.x, cam.position.z - pos.z);
    nik.root.setEnabled(true);
    activo = true;
    asustado = false;
    activoDesde = performance.now();
  };

  game.onUpdate.push(() => {
    // acecha en la planta 1 y en el ala C (en el Archivo ya está él "de verdad")
    const nvNik = (state.get("nivel") as number) ?? 1;
    if (nvNik < 2 || nvNik === 3 || !game.playing || game.uiBlocked()) return;
    const cam = game.player.camera;
    const now = performance.now();
    if (!iniciado) {
      iniciado = true;
      siguiente = now + 16000 + Math.random() * 15000;
      return;
    }
    const fwd = cam.getDirection(Vector3.Forward());
    fwd.y = 0;
    fwd.normalize();

    if (activo) {
      const hacia = nik.root.position.subtract(cam.position);
      hacia.y = 0;
      const dist = hacia.length();
      hacia.normalize();
      const mirandolo = Vector3.Dot(fwd, hacia) > 0.35; // lo tienes en pantalla
      if (!asustado && dist < 9 && Vector3.Dot(fwd, hacia) > 0.55) {
        // sin sonido ni aspavientos: el susto es verlo ahí, tan cerca, en silencio
        asustado = true;
      }
      // regla de oro: JAMÁS se desvanece mientras lo estás mirando
      if (!mirandolo) {
        const caducado = asustado
          ? dist > 7 || now - activoDesde > 20000
          : dist > 14 || now - activoDesde > 30000;
        if (caducado) {
          nik.root.setEnabled(false);
          activo = false;
          siguiente = now + 17000 + Math.random() * 26000;
        }
      }
      return;
    }

    if (now < siguiente) return;
    if (Math.random() < 0.5) {
      // pegado a tu espalda, MUY cerca: al girarte lo tienes encima
      const pos = cam.position.subtract(fwd.scale(0.95));
      const ray = new Ray(cam.position, fwd.scale(-1), 1.25);
      const hit = scene.pickWithRay(ray, (mm) => mm.checkCollisions && mm.isEnabled());
      if (!hit?.hit) {
        aparecer(pos);
        return;
      }
    } else {
      // esperando al doblar una esquina: cerca y mirándote, fuera de tu vista
      const candidatas = buscarEsquinas(fwd);
      if (candidatas.length) {
        aparecer(candidatas[Math.floor(Math.random() * candidatas.length)]);
        return;
      }
    }
    siguiente = now + 4000; // no ha podido: reintenta pronto
  });

  // ------------------------------------------------------------- luces y transición
  const placeLights = () => {
    const L = game.levelLights;
    const set = (i: number, x: number, z: number, intensity: number, range: number, color?: Color3) => {
      const l = L[i];
      if (!l) return;
      l.position.set(x, 2.62, z);
      l.intensity = intensity;
      l.range = range;
      if (color) l.diffuse = color;
    };
    const warm = new Color3(1, 0.82, 0.58);
    set(0, 10, cz(3), 0.5, 13, warm); // cocina
    set(1, 30, cz(7.5), 0.55, 15, warm); // pasillo norte (hereda el parpadeo)
    set(2, 45, cz(3), 0.55, 13, new Color3(0.8, 0.9, 1)); // despacho
    set(3, 30, cz(12), 0.65, 17, warm); // hall
    set(4, 3, cz(12), 0.32, 10, new Color3(0.7, 0.75, 0.9)); // corredor oeste
    set(5, 13, cz(18), 0.5, 13, new Color3(0.75, 0.85, 1)); // terapia
    set(6, 45, cz(18), 0.45, 13, warm); // almacén
    set(7, 27, cz(15), 0.5, 11, new Color3(0.55, 1, 0.6)); // altar
    if (state.get("luz_almacen_off")) {
      const l = L[6];
      if (l) l.intensity = 0;
    }
  };

  game.enterLevel2 = async () => {
    if (state.get("nivel") === 2) return;
    game.playing = false;
    game.player.setControl(false);
    await hud.fade(true, 1500);
    state.set("nivel", 2);
    placeLights();
    hud.setLocation("PLANTA 1 · ARCHIVO");
    const cam = game.player.camera;
    cam.position.set(55, 1.62, 75);
    cam.rotation.set(0, -Math.PI / 2, 0);
    updateObjective2();
    hud.setLocation("PLANTA 1 · ADMISIONES");
    game.savePlayer();
    if (!state.get("visto_p1")) {
      state.set("visto_p1");
      await game.interlude([
        "PLANTA 1",
        "ARCHIVO GENERAL · ADMISIONES",
        "El aire sabe a papel mojado y a lejía.",
      ]);
    } else {
      await new Promise((r) => setTimeout(r, 250));
    }
    game.playing = true;
    game.player.setControl(true);
    await hud.fade(false, 1800);
    game.checkPause();
  };

  if (state.get("nivel") === 2) {
    placeLights();
    updateObjective2();
  }
}
