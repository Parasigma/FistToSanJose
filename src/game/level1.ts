import {
  Animation,
  Color3,
  DynamicTexture,
  EasingFunction,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointLight,
  SineEase,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { colorMat, grimeTexture, texMat } from "../core/textures";
import { DTree } from "../ui/dialogue";
import { hud } from "../ui/hud";
import { minimap } from "../ui/minimap";
import { Game } from "./Game";
import { installMirror } from "./mirror";
import { createNPC } from "./npc";

const T = 2;
const WALL_H = 3;

// Leyenda: '#' muro, '.' suelo. 1 tile = 2m.
const MAP = [
  "################################",
  "#...#...#...#...#.......########",
  "#...#...#...#...#.......########",
  "#...#...#...#...#.......########",
  "##.###.###.###.#####.###########",
  "#..............................#",
  "#..............................#",
  "#..............................#",
  "#####..##########.#####.####.###",
  "#.............#.....#.....#....#",
  "#.............#.....#.....#....#",
  "#.............#.....#.....#....#",
  "#.............#.....#.....#....#",
  "#.............#.....#.....#....#",
  "#.............#.....#.....#....#",
  "################################",
];

const cx = (c: number) => (c + 0.5) * T;
const cz = (r: number) => (r + 0.5) * T;

export function buildLevel1(game: Game) {
  const scene = game.scene;
  const state = game.state;

  // ------------------------------------------------------------- materiales
  const matWall = texMat(scene, "wall", grimeTexture(scene, "wallT", { base: "#6f7663", stains: 8, zocalo: "#464a3d" }));
  const matFloor = texMat(
    scene,
    "floor",
    grimeTexture(scene, "floorT", { base: "#67635a", tiles: 2, speckle: 3600, stains: 9 }),
    MAP[0].length,
    MAP.length
  );
  const matCeil = texMat(
    scene,
    "ceil",
    grimeTexture(scene, "ceilT", { base: "#3c3b38", speckle: 2000, stains: 10 }),
    MAP[0].length,
    MAP.length
  );
  const matDoor = texMat(scene, "door", grimeTexture(scene, "doorT", { base: "#5e7078", planks: true, stains: 5 }));
  const matFrame = colorMat(scene, "frame", "#3a3c38");
  const matWood = texMat(scene, "wood", grimeTexture(scene, "woodT", { base: "#54432f", planks: true, speckle: 1500 }));
  const matMetal = texMat(scene, "metal", grimeTexture(scene, "metalT", { base: "#767b7e", speckle: 1600, stains: 6 }));
  const matSheet = colorMat(scene, "sheet", "#a8a294");
  const matPillow = colorMat(scene, "pillow", "#c4beae");
  const matSofa = colorMat(scene, "sofa", "#585f4e");
  const matDark = colorMat(scene, "dark", "#232326");
  const matPaper = colorMat(scene, "paper", "#d6d0be", 0.12);
  const matGold = colorMat(scene, "gold", "#c2a044", 0.15);
  const matRadio = colorMat(scene, "radioM", "#6e4526");
  const matRed = colorMat(scene, "red", "#6e2a24");
  const matWhite = colorMat(scene, "white", "#b9b6ac");

  // ------------------------------------------------------------- geometría
  const boxes: Mesh[] = [];
  for (let r = 0; r < MAP.length; r++) {
    for (let c = 0; c < MAP[r].length; c++) {
      if (MAP[r][c] !== "#") continue;
      let nearFloor = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (MAP[r + dr]?.[c + dc] === ".") nearFloor = true;
        }
      }
      if (!nearFloor) continue;
      const b = MeshBuilder.CreateBox("w", { width: T, height: WALL_H, depth: T }, scene);
      b.position.set(cx(c), WALL_H / 2, cz(r));
      boxes.push(b);
    }
  }
  const walls = Mesh.MergeMeshes(boxes, true, true)!;
  walls.name = "walls";
  walls.material = matWall;
  walls.checkCollisions = true;
  walls.freezeWorldMatrix();

  const W = MAP[0].length * T;
  const H = MAP.length * T;
  const ground = MeshBuilder.CreateGround("ground", { width: W, height: H }, scene);
  ground.position.set(W / 2, 0, H / 2);
  ground.material = matFloor;
  ground.checkCollisions = true;

  const ceil = MeshBuilder.CreateGround("ceil", { width: W, height: H }, scene);
  ceil.position.set(W / 2, WALL_H, H / 2);
  ceil.rotation.x = Math.PI;
  ceil.material = matCeil;

  // ------------------------------------------------------------- luces
  const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.16;
  hemi.diffuse = new Color3(0.55, 0.6, 0.75);
  hemi.groundColor = new Color3(0.06, 0.05, 0.05);

  const warm = new Color3(1, 0.82, 0.58);
  const mkLight = (x: number, z: number, intensity = 0.6, range = 14, color = warm) => {
    const l = new PointLight("pl", new Vector3(x, 2.62, z), scene);
    l.diffuse = color;
    l.intensity = intensity;
    l.range = range;
    game.levelLights.push(l);
    return l;
  };
  const LIGHTS1: Array<[number, number, number, number, Color3?]> = [
    [10, 13, 0.55, 14],
    [30, 13, 0.55, 14],
    [50, 13, 0.55, 14],
    [5, 5, 0.4, 9],
    [14, 24, 0.6, 16],
    [35, 24, 0.55, 13],
    [47, 24, 0.6, 13, new Color3(0.8, 0.9, 1)],
    [58, 26, 0.45, 11, new Color3(0.55, 1, 0.6)],
  ];
  for (const c of LIGHTS1) mkLight(c[0], c[1], c[2], c[3], c[4]);
  const flick = game.levelLights[1];
  // al volver de plantas inferiores hay que devolver las luces a su sitio
  const placeLights1 = () => {
    LIGHTS1.forEach((c, i) => {
      const l = game.levelLights[i];
      if (!l) return;
      l.position.set(c[0], 2.62, c[1]);
      l.intensity = c[2];
      l.range = c[3];
      l.diffuse = c[4] ?? warm;
    });
  };
  // El baño queda a oscuras a propósito: territorio de la linterna.
  // (Máximo 10 luces por material: linterna + hemisférica + 8 puntuales.)

  let ft = Math.random() * 100;
  game.onUpdate.push((dt) => {
    ft += dt;
    const n = Math.sin(ft * 13) * Math.sin(ft * 7.3) * Math.sin(ft * 2.1);
    flick.intensity = 0.5 + n * 0.14 - (Math.random() < 0.008 ? 0.45 : 0);
  });

  // ------------------------------------------------------------- helpers
  const box = (
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: StandardMaterial,
    opts?: { ry?: number; collide?: boolean }
  ) => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    if (opts?.ry) m.rotation.y = opts.ry;
    m.material = mat;
    m.checkCollisions = opts?.collide !== false;
    return m;
  };

  const sign = (text: string, x: number, y: number, z: number, faceRy: number, fg = "#cfc9b8", bg = "#20221f", w = 1.5) => {
    // textura del ancho justo del texto: nada de rótulos cortados
    const texW = Math.max(128, text.length * 23 + 40);
    const dt = new DynamicTexture("sg_" + text, { width: texW, height: 64 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
    dt.drawText(text, null, 44, "bold 38px 'Courier New'", fg, bg, true);
    const m = new StandardMaterial("sgm_" + text, scene);
    m.diffuseTexture = dt;
    m.emissiveTexture = dt;
    m.emissiveColor = new Color3(0.55, 0.55, 0.55);
    m.specularColor = Color3.Black();
    const p = MeshBuilder.CreatePlane("sgp_" + text, { width: w, height: w * (64 / texW), sideOrientation: Mesh.DOUBLESIDE }, scene);
    p.position.set(x, y, z);
    p.rotation.y = faceRy + Math.PI;
    p.material = m;
    return p;
  };

  const ease = new SineEase();
  ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

  interface Door {
    hinge: TransformNode;
    mesh: Mesh;
    open: boolean;
    baseRy: number;
    toggle: (silent?: boolean) => void;
  }

  // Puerta en hueco de 2m. ry=0: puerta contenida en muro este-oeste.
  const makeDoor = (x: number, z: number, ry: number, startOpen = false): Door => {
    const hinge = new TransformNode("hinge", scene);
    // eje en el borde izquierdo del hueco según la orientación
    hinge.position.set(x + Math.cos(ry) * -0.85, 0, z + Math.sin(ry) * 0.85);
    hinge.rotation.y = ry;
    const mesh = MeshBuilder.CreateBox("doorM", { width: 1.7, height: 2.48, depth: 0.11 }, scene);
    mesh.position.set(0.85, 1.24, 0);
    mesh.material = matDoor;
    mesh.checkCollisions = true;
    mesh.parent = hinge;
    const knob = MeshBuilder.CreateBox("knob", { width: 0.1, height: 0.1, depth: 0.26 }, scene);
    knob.position.set(1.5, 1.1, 0);
    knob.material = matGold;
    knob.parent = hinge;

    // marco
    box("fL", 0.16, 2.6, 0.32, x + Math.cos(ry) * -0.95, 1.3, z + Math.sin(ry) * 0.95, matFrame);
    box("fR", 0.16, 2.6, 0.32, x + Math.cos(ry) * 0.95, 1.3, z + Math.sin(ry) * -0.95, matFrame);
    const lin = box("fT", 2.1, 0.55, 0.34, x, 2.76, z, matFrame);
    if (ry !== 0) lin.rotation.y = ry;

    const door: Door = {
      hinge,
      mesh,
      open: startOpen,
      baseRy: ry,
      toggle(silent = false) {
        this.open = !this.open;
        const target = this.open ? ry - 1.85 : ry;
        Animation.CreateAndStartAnimation("da", hinge, "rotation.y", 60, 45, hinge.rotation.y, target, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
        if (!silent) game.sfx.doorCreak();
      },
    };
    if (startOpen) hinge.rotation.y = ry - 1.85;
    return door;
  };

  const lintelOnly = (x: number, z: number, wdt = 2.1, ry = 0) => {
    const l = box("lint", wdt, 0.55, 0.34, x, 2.76, z, matFrame);
    l.rotation.y = ry;
  };

  // ------------------------------------------------------------- puertas
  // Celdas (muro fila 4, z=9): 104 (Mario, x5), 102 (x13), 103 (x21), 101 (x29)
  const doorC1 = makeDoor(5, 9, 0, true); // abierta misteriosamente
  const doorC2 = makeDoor(13, 9, 0);
  const doorC3 = makeDoor(21, 9, 0, true);
  const doorC4 = makeDoor(29, 9, 0);
  lintelOnly(41, 9); // baños sin puerta

  // Ala sur (muro fila 8, z=17)
  lintelOnly(12, 17, 4.3); // sala común, doble hueco
  const doorLav = makeDoor(35, 17, 0);
  const doorEnf = makeDoor(47, 17, 0);
  lintelOnly(57, 17); // acceso escalera sin puerta

  if (state.get("enf_open") && !doorEnf.open) doorEnf.toggle(true);

  game.register(doorC2.mesh, "doorC2", "Puerta — 102", () => {
    game.sfx.locked();
    game.talk(
      {
        p1: {
          speaker: "VOZ AL OTRO LADO (102)",
          text: "No empujes la puerta, vecino.\nLa última vez que alguien empujó, la puerta perdió.",
          next: "p2",
        },
        p2: {
          text: "Me la reforzaron con adamantium. Palabra del Director.\nYo aquí estoy bien: la pared aguanta... si no me apoyo.",
          action: () => state.set("oyo_paquito"),
        },
      },
      "p1"
    );
  });
  game.register(doorC4.mesh, "doorC4", "Puerta — 101", () => {
    game.sfx.locked();
    game.talk(
      {
        h1: {
          speaker: "HABITACIÓN 101",
          text: "Cerrada con llave.\nPor debajo de la puerta sale luz. Siempre sale luz.\nEn el cartel no hay nombre, y nadie vigila esta habitación.",
        },
      },
      "h1"
    );
  });
  game.register(doorLav.mesh, "doorLav", () => (doorLav.open ? "Cerrar la puerta" : "Abrir la puerta"), () => doorLav.toggle());
  game.register(doorEnf.mesh, "doorEnf", () => (state.get("enf_open") ? (doorEnf.open ? "Cerrar la puerta" : "Abrir la puerta") : "Enfermería — teclado numérico"), () => {
    if (state.get("enf_open")) {
      doorEnf.toggle();
      return;
    }
    game.openKeypad("2413", () => {
      state.set("enf_open");
      doorEnf.toggle();
      updateObjective();
      game.notify("El cierre magnético se suelta con un chasquido.");
    });
  });

  // Puerta de salida (escalera), muro sur de la sala de escalera
  const exitDoor = makeDoor(58, 29.9, 0);
  sign("SALIDA", 58, 2.7, 29.6, Math.PI, "#9fe89f", "#0d2010", 1.2);
  game.register(exitDoor.mesh, "exitDoor", () => (state.has("llave_escalera") ? "Usar la llave" : "Puerta de la escalera"), () => {
    if (((state.get("nivel") as number) ?? 1) >= 2) {
      game.notify("Por ahí se vuelve a subir. El San José solo deja bajar.");
      return;
    }
    if (state.has("llave_escalera")) {
      game.sfx.unlock();
      game.notify("La llave gira. El aire frío sube desde la planta baja...");
      state.set("nivel1_completado");
      setTimeout(() => game.enterLevel2?.(), 1400);
    } else {
      game.sfx.locked();
      state.set("vio_puerta");
      updateObjective();
      game.notify("Cerrada con llave. En el cartel: ESCALERA — ACCESO RESTRINGIDO.");
    }
  });

  // ------------------------------------------------------------- carteles
  sign("104", 5, 2.62, 10.08, 0, "#cfc9b8", "#20221f", 0.9);
  sign("102", 13, 2.62, 10.08, 0, "#cfc9b8", "#20221f", 0.9);
  sign("103", 21, 2.62, 10.08, 0, "#cfc9b8", "#20221f", 0.9);
  sign("101", 29, 2.62, 10.08, 0, "#cfc9b8", "#20221f", 0.9);
  sign("BAÑOS", 41, 2.62, 10.08, 0);
  sign("SALA COMÚN", 12, 2.62, 15.92, Math.PI, "#cfc9b8", "#20221f", 2.2);
  sign("LAVANDERÍA", 35, 2.62, 15.92, Math.PI, "#cfc9b8", "#20221f", 2.0);
  sign("ENFERMERÍA", 47, 2.62, 15.92, Math.PI, "#d8e8f0", "#1d2a30", 2.0);
  sign("ESCALERA", 57, 2.62, 15.92, Math.PI, "#9fe89f", "#0d2010", 1.7);

  // ------------------------------------------------------------- celda 104 (Mario)
  const mkBed = (x: number, z: number, ry = 0) => {
    box("bedF", 1.0, 0.32, 2.0, x, 0.16, z, matMetal, { ry });
    box("bedM", 0.94, 0.16, 1.94, x, 0.4, z, matSheet, { ry, collide: false });
    const px = x + Math.sin(ry) * 0 - Math.cos(ry) * 0;
    box("bedP", 0.6, 0.1, 0.4, x, 0.52, z - 0.7, matPillow, { ry, collide: false });
  };
  mkBed(3.2, 4);
  box("desk104", 1.2, 0.78, 0.6, 7, 0.39, 3.2, matWood);

  const diario = box("diario", 0.32, 0.06, 0.42, 7, 0.81, 3.2, matRed, { collide: false });
  game.register(diario, "diario", "Diario — guardar partida", () => {
    game.savePlayer();
    game.sfx.save();
    game.notify("Escribes con letra temblorosa. Partida guardada.");
  });

  // la linterna, junto al diario: hay que cogerla para poder usarla
  if (!state.has("linterna")) {
    const linRoot = new TransformNode("linternaRoot", scene);
    linRoot.position.set(6.45, 0.83, 3.35);
    linRoot.rotation.y = 0.7;
    const linBody = MeshBuilder.CreateCylinder("linterna104", { diameter: 0.055, height: 0.19, tessellation: 10 }, scene);
    linBody.rotation.z = Math.PI / 2;
    linBody.material = matDark;
    linBody.parent = linRoot;
    const linHead = MeshBuilder.CreateCylinder("linterna104h", { diameterTop: 0.058, diameterBottom: 0.08, height: 0.06, tessellation: 10 }, scene);
    linHead.rotation.z = Math.PI / 2;
    linHead.position.x = -0.12;
    linHead.material = matDark;
    linHead.parent = linRoot;
    game.register([linBody, linHead], "linterna104", "Coger la linterna", () => {
      state.addItem({
        id: "linterna",
        name: "Linterna de celador",
        desc: "Correa de mano gastada y una pegatina medio arrancada: «B. — TURNO NOCHE». Enciende con [Q].",
      });
      linRoot.dispose();
      game.player.setFlashlightHidden(false);
      game.sfx.pickup();
      game.notify("Has cogido la linterna. Pulsa [Q] para encenderla.");
    });
  }

  const nota = box("nota", 0.28, 0.012, 0.36, 5.3, 0.02, 7.6, matPaper, { collide: false });
  game.register(nota, "nota", "Leer la nota", () => {
    state.set("nota_leida");
    updateObjective();
    game.talk(
      {
        n1: {
          speaker: "NOTA ARRUGADA",
          text: "«SI QUIERES SALIR DE AQUÍ, CONFÍA EN MÍ.\n\nTe he dejado la puerta abierta.\nBaja por la escalera antes de que suene la campana.»\n\nFirmado: C.M.",
          next: "n2",
        },
        n2: {
          text: "(La letra te resulta extrañamente familiar.\nNo sabes de qué. Mejor no pensarlo ahora.)",
        },
      },
      "n1"
    );
  });

  // ------------------------------------------------------------- otras celdas
  mkBed(11.2, 4); // 102
  mkBed(19.2, 4); // 103 (Montreal)
  mkBed(27.2, 4); // 101

  // el mapa de evacuación de Montreal (habitación 103): activa el minimapa
  minimap.register(1, MAP, 0);
  box("mesilla103", 0.6, 0.62, 0.5, 23, 0.31, 3.2, matWood);
  if (!state.has("mapa")) {
    const mapaM = box("mapa103", 0.36, 0.015, 0.28, 23, 0.65, 3.2, matPaper, { collide: false });
    mapaM.rotation.y = 0.4;
    game.register(mapaM, "mapa103", "Coger el mapa de evacuación", () => {
      state.addItem({
        id: "mapa",
        name: "Mapa de evacuación",
        desc: "El plano del sanatorio, arrancado de su marco. Montreal lo tenía «por deformación profesional». Ahora te acompaña arriba a la derecha.",
      });
      mapaM.dispose();
      game.sfx.pickup();
      game.notify("Has cogido el mapa de evacuación. El plano aparece arriba a la derecha.");
    });
  }

  // ------------------------------------------------------------- baños
  const lavabos: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    lavabos.push(box("sink" + i, 0.7, 0.5, 0.5, 36.5 + i * 1.6, 0.85, 2.5, matWhite));
  }
  const espejo = box("espejo", 4.4, 0.9, 0.06, 38.1, 1.85, 2.1, matMetal, { collide: false });
  const st1 = box("stall1", 0.08, 2.2, 3.5, 45.5, 1.1, 4.2, matMetal);
  const st2 = box("stall2", 2.4, 2.2, 0.08, 46.7, 1.1, 6, matMetal);

  // Pintada que SOLO existe en el reflejo: en la pared del fondo del baño
  // (la que el espejo devuelve), invisible si te giras a mirarla de verdad.
  const pintadaTex = new DynamicTexture("pintadaT", { width: 1024, height: 256 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  {
    const c = pintadaTex.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 1024, 256);
    // se pinta EN ESPEJO: el reflejo la endereza y así se puede leer
    c.save();
    c.translate(1024, 0);
    c.scale(-1, 1);
    c.fillStyle = "#b31f13";
    c.textAlign = "center";
    c.save();
    c.translate(512, 0);
    c.rotate(-0.028);
    c.font = "bold 176px 'Courier New'";
    c.fillText("KUROI TE", 0, 190);
    c.restore();
    // chorretones de pintura fresca
    for (const [x, y, h] of [[236, 196, 44], [430, 200, 30], [612, 194, 52], [790, 198, 36]]) {
      c.globalAlpha = 0.72;
      c.fillRect(x, y, 6, h);
      c.beginPath();
      c.arc(x + 3, y + h, 6, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
  }
  pintadaTex.update();
  pintadaTex.hasAlpha = true;

  const matPintada = new StandardMaterial("pintadaM", scene);
  matPintada.diffuseTexture = pintadaTex;
  matPintada.opacityTexture = pintadaTex;
  matPintada.emissiveTexture = pintadaTex;
  matPintada.emissiveColor = new Color3(0.5, 0.5, 0.5);
  matPintada.specularColor = Color3.Black();
  matPintada.backFaceCulling = false;

  // dos palabras enormes y arrinconadas: legibles en el cristal, y el gemelo
  // del reflejo (que va centrado) no las tapa
  const pintada = MeshBuilder.CreatePlane("pintadaBano", { width: 4.0, height: 1.0 }, scene);
  pintada.position.set(36.1, 1.72, 7.92); // esquina izquierda de la pared del fondo
  pintada.material = matPintada;
  pintada.isPickable = false;
  pintada.setEnabled(false);

  installMirror(game, {
    mesh: espejo,
    normal: new Vector3(0, 0, 1),
    extra: [walls, ground, ceil, ...lavabos, st1, st2],
    ghosts: [pintada],
    nivel: 1,
    size: 768, // hace falta resolución: aquí dentro hay algo que leer
  });
  // Solo describe tu reflejo: lo que haya escrito al fondo lo descubre el
  // jugador con sus propios ojos, el juego no se lo cuenta.
  game.register(espejo, "espejo", "Mirarte al espejo", () => {
    game.talk(
      {
        e1: {
          speaker: "ESPEJO",
          text: "Un tipo con pijama de paciente te devuelve la mirada.\nOjeras. Pelo corto de injerto reciente.\nDía 217.",
          next: "e2",
        },
        e2: {
          text: () =>
            state.get("mario_tomo_curso")
              ? "Levantas la mano. Él la levanta.\nTe quedas quieto. Él se queda quieto.\n\n(Y aun así juras que ha parpadeado antes que tú.)"
              : "El cristal está rayado y verdoso.\nLa cara que te devuelve tarda un instante de más\nen hacer lo que tú haces.",
          action: () => state.set("mirado_espejo"),
        },
      },
      "e1"
    );
  });

  // ------------------------------------------------------------- sala común
  // TV con estática
  box("mueble", 1.5, 0.55, 0.6, 3.1, 0.28, 24, matWood);
  box("tvBody", 0.62, 0.94, 1.18, 3.1, 1.05, 24, matDark);
  // --- televisor sintonizable: dial con el ratón, dos canales escondidos ---
  const TVW = 192;
  const TVH = 144;
  const tvTex = new DynamicTexture("tvT", { width: TVW, height: TVH }, scene, false, Texture.NEAREST_SAMPLINGMODE);
  const tvCtx = tvTex.getContext() as unknown as CanvasRenderingContext2D;
  const tvMat = new StandardMaterial("tvScreen", scene);
  tvMat.emissiveTexture = tvTex;
  tvMat.diffuseColor = Color3.Black();
  tvMat.specularColor = Color3.Black();
  const tvScreen = MeshBuilder.CreatePlane("tvP", { width: 1.0, height: 0.75 }, scene);
  tvScreen.position.set(3.45, 1.1, 24);
  tvScreen.rotation.y = -Math.PI / 2;
  tvScreen.material = tvMat;

  // dial físico bajo la pantalla
  const dialNode = new TransformNode("tvDial", scene);
  dialNode.position.set(3.44, 0.56, 24.42);
  const dialCyl = MeshBuilder.CreateCylinder("tvDialC", { diameter: 0.1, height: 0.05, tessellation: 12 }, scene);
  dialCyl.rotation.z = Math.PI / 2;
  dialCyl.material = matGold;
  dialCyl.parent = dialNode;
  const dialMark = MeshBuilder.CreateBox("tvDialM", { width: 0.02, height: 0.035, depth: 0.014 }, scene);
  dialMark.position.set(0.028, 0.03, 0);
  dialMark.material = matDark;
  dialMark.parent = dialNode;

  const CH_DESPACHO = 0.33;
  const CH_SERNA = 0.71;
  const CH_ANCHO = 0.05;
  let tune = 0.5;
  let tvMode = 0; // 0 apagada-de-lejos · 1 acercando · 2 viendo · 3 saliendo
  let tvDrag = false;
  let tvLastX = 0;
  let tvStart = 0;
  const tvFrom = new Vector3();
  let tvFromRx = 0;
  let tvFromRy = 0;
  let adT = 0;
  let rollY = 0;
  const tvSaved = { pos: new Vector3(), rx: 0, ry: 0 };
  const tvViewPos = new Vector3(4.68, 1.18, 24);
  const claridad = (c: number) => Math.max(0, 1 - Math.abs(tune - c) / CH_ANCHO);
  const lerpAngle = (a: number, b: number, k: number) => {
    let d = b - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return a + d * k;
  };

  const drawRuido = (alpha: number) => {
    if (alpha <= 0.02) return;
    tvCtx.globalAlpha = alpha;
    for (let i = 0; i < 520; i++) {
      const v = (Math.random() * 200) | 0;
      tvCtx.fillStyle = `rgb(${v},${v},${v})`;
      tvCtx.fillRect(Math.random() * TVW, Math.random() * TVH, 3, 2);
    }
    tvCtx.globalAlpha = 1;
  };

  const drawDespacho = () => {
    // cámara de seguridad en blanco y negro: el despacho del Director
    tvCtx.fillStyle = "#101010";
    tvCtx.fillRect(0, 0, TVW, TVH);
    tvCtx.fillStyle = "#1c1c1c";
    tvCtx.fillRect(0, 92, TVW, 52); // suelo
    tvCtx.strokeStyle = "#242424";
    for (let i = 0; i < 5; i++) {
      tvCtx.beginPath();
      tvCtx.moveTo(96 + (i - 2) * 14, 92);
      tvCtx.lineTo(96 + (i - 2) * 64, 144);
      tvCtx.stroke();
    }
    // estanterías del fondo
    tvCtx.fillStyle = "#181818";
    tvCtx.fillRect(8, 22, 34, 70);
    tvCtx.fillRect(150, 22, 34, 70);
    tvCtx.fillStyle = "#222";
    for (let y = 30; y < 88; y += 12) {
      tvCtx.fillRect(10, y, 30, 3);
      tvCtx.fillRect(152, y, 30, 3);
    }
    // mesa del despacho
    tvCtx.fillStyle = "#383838";
    tvCtx.fillRect(56, 86, 80, 22);
    tvCtx.fillStyle = "#242424";
    tvCtx.fillRect(60, 108, 6, 18);
    tvCtx.fillRect(126, 108, 6, 18);
    // el gran sillón, vacío
    tvCtx.fillStyle = "#2b2b2b";
    tvCtx.fillRect(78, 38, 36, 52);
    tvCtx.fillRect(72, 44, 8, 40);
    tvCtx.fillRect(112, 44, 8, 40);
    tvCtx.fillStyle = "#333";
    tvCtx.fillRect(84, 30, 24, 12); // reposacabezas sin cabeza
    // rótulos de cámara
    tvCtx.fillStyle = "#d8d8d8";
    tvCtx.font = "bold 10px monospace";
    tvCtx.fillText("CAM 01 · DESPACHO", 6, 140);
    tvCtx.fillText("3:5" + ((Math.random() * 9) | 0) + " AM", 146, 12);
    if (Math.floor(performance.now() / 600) % 2 === 0) {
      tvCtx.fillText("● REC", 6, 12);
    }
    // línea de barrido que sube
    rollY = (rollY + 2.5) % TVH;
    tvCtx.fillStyle = "rgba(255,255,255,0.06)";
    tvCtx.fillRect(0, TVH - rollY, TVW, 3);
  };

  const drawSerna = () => {
    // anuncio en bucle: MUDANZAS SERNA, nosotros no necesitamos grúa
    const ph = (adT % 4) / 4;
    tvCtx.fillStyle = "#d0b258";
    tvCtx.fillRect(0, 0, TVW, TVH);
    tvCtx.fillStyle = "#8a2a20";
    tvCtx.fillRect(0, 0, TVW, 16);
    tvCtx.fillRect(0, TVH - 16, TVW, 16);
    // edificio
    tvCtx.fillStyle = "#a89478";
    tvCtx.fillRect(126, 26, 52, 102);
    tvCtx.fillStyle = "#3a3430";
    for (let fy = 0; fy < 5; fy++) {
      for (let fx = 0; fx < 3; fx++) {
        tvCtx.fillRect(132 + fx * 16, 32 + fy * 19, 10, 12);
      }
    }
    // ventana de destino (quinto piso), iluminada
    tvCtx.fillStyle = "#ffe9a8";
    tvCtx.fillRect(148, 32, 10, 12);
    // Paquito (figura fornida)
    tvCtx.fillStyle = "#2a2020";
    tvCtx.fillRect(30, 96, 22, 26); // torso ancho
    tvCtx.beginPath();
    tvCtx.arc(41, 90, 7, 0, Math.PI * 2);
    tvCtx.fill();
    // el sofá volando a pulso
    const t = Math.min(1, ph * 1.8);
    const sx = 44 + 106 * t;
    const sy = 110 - 150 * t * (1 - t) - 72 * t;
    tvCtx.save();
    tvCtx.translate(sx, sy);
    tvCtx.rotate(t * 4.2);
    tvCtx.fillStyle = "#7a3030";
    tvCtx.fillRect(-11, -5, 22, 10);
    tvCtx.fillRect(-11, -9, 5, 6);
    tvCtx.restore();
    if (ph > 0.62) {
      // impacto perfecto: destello en la ventana
      tvCtx.strokeStyle = "#fff2c8";
      tvCtx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        tvCtx.beginPath();
        tvCtx.moveTo(153 + Math.cos(a) * 8, 38 + Math.sin(a) * 8);
        tvCtx.lineTo(153 + Math.cos(a) * 15, 38 + Math.sin(a) * 15);
        tvCtx.stroke();
      }
    }
    // rótulos
    tvCtx.fillStyle = "#241810";
    tvCtx.font = "bold 16px monospace";
    tvCtx.fillText("MUDANZAS SERNA", 14, 40 + Math.sin(adT * 5) * 2);
    tvCtx.font = "bold 9px monospace";
    tvCtx.fillStyle = ph > 0.62 && Math.floor(adT * 6) % 2 === 0 ? "#8a2a20" : "#241810";
    tvCtx.fillText("¡NOSOTROS NO NECESITAMOS GRÚA!", 8, 58);
    tvCtx.fillStyle = "#fff2c8";
    tvCtx.font = "bold 9px monospace";
    tvCtx.fillText("PRESUPUESTO SIN COMPROMISO · PISOS ALTOS: GRATIS", 4, TVH - 6);
  };

  let tvAcc = 0;
  game.onUpdate.push((dt) => {
    adT += dt;
    // cámara: acercarse / alejarse de la tele
    const cam = game.player.camera;
    // Transición por reloj real (no por delta de fotograma): así el modo
    // siempre acaba de completarse aunque el render vaya a trompicones.
    if (tvMode === 1 || tvMode === 3) {
      const p = Math.min(1, (performance.now() - tvStart) / 850);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const dest = tvMode === 1 ? tvViewPos : tvSaved.pos;
      const drx = tvMode === 1 ? 0.07 : tvSaved.rx;
      const dry = tvMode === 1 ? -Math.PI / 2 : tvSaved.ry;
      cam.position = Vector3.Lerp(tvFrom, dest, e);
      cam.rotation.x = lerpAngle(tvFromRx, drx, e);
      cam.rotation.y = lerpAngle(tvFromRy, dry, e);
      if (p >= 1) {
        cam.position.copyFrom(dest);
        cam.rotation.x = drx;
        cam.rotation.y = dry;
        if (tvMode === 1) tvMode = 2;
        else {
          tvMode = 0;
          game.modal = false;
          game.player.lockY = true;
          game.player.setControl(true);
          game.checkPause();
        }
      }
    }
    // audio y giro del dial
    const cA = tvMode >= 1 ? claridad(CH_DESPACHO) : 0;
    const cB = tvMode >= 1 ? claridad(CH_SERNA) : 0;
    dialNode.rotation.x = -tune * 4.4;
    if (tvMode === 2) {
      game.sfx.tvTune(Math.max(cA, cB), tune);
      if (cB > 0.6) game.sfx.jingleStart();
      else game.sfx.jingleStop();
      if (cA > 0.55 && !state.get("tv_despacho")) state.set("tv_despacho");
      if (cB > 0.55 && !state.get("tv_serna")) state.set("tv_serna");
    }
    // refresco de pantalla
    tvAcc += dt;
    if (tvAcc < 0.05) return;
    tvAcc = 0;
    tvCtx.fillStyle = "#000";
    tvCtx.fillRect(0, 0, TVW, TVH);
    if (cA > 0.12) drawDespacho();
    else if (cB > 0.12) drawSerna();
    drawRuido(Math.max(0.1, 1 - Math.max(cA, cB)));
    tvTex.update();
  });

  // Instancia de puzle: fuera queda todo en pausa (linterna y HUD guardados)
  const enterTv = () => {
    if (tvMode !== 0 || game.uiBlocked()) return;
    tvMode = 1;
    game.modal = true;
    game.player.setControl(false);
    game.player.lockY = false;
    game.player.setFlashlightHidden(true);
    document.exitPointerLock?.();
    const cam = game.player.camera;
    tvSaved.pos.copyFrom(cam.position);
    tvSaved.rx = cam.rotation.x;
    tvSaved.ry = cam.rotation.y;
    tvFrom.copyFrom(cam.position);
    tvFromRx = cam.rotation.x;
    tvFromRy = cam.rotation.y;
    tvStart = performance.now();
    hud.hide();
    document.getElementById("tv-ui")!.classList.remove("hidden");
    game.sfx.tvStart();
  };
  const exitTv = () => {
    if (tvMode !== 2) return;
    tvMode = 3;
    tvDrag = false;
    tvFrom.copyFrom(game.player.camera.position);
    tvFromRx = game.player.camera.rotation.x;
    tvFromRy = game.player.camera.rotation.y;
    tvStart = performance.now();
    game.sfx.tvStop();
    game.player.setFlashlightHidden(!state.has("linterna"));
    document.getElementById("tv-ui")!.classList.add("hidden");
    hud.show();
    game.tryLock();
  };

  const setTune = (v: number) => {
    tune = Math.min(1, Math.max(0, v));
    const n = document.getElementById("tv-needle");
    if (n) n.style.left = (tune * 100).toFixed(1) + "%";
  };
  setTune(tune);

  // Varias formas de girar el dial: arrastrar, rueda y flechas.
  // (El arrastre usa la posición real del cursor: movementX no es fiable
  // sin captura de puntero, que aquí está liberada a propósito.)
  document.addEventListener("keydown", (e) => {
    if (tvMode !== 2) return;
    if (e.code === "KeyE" || e.code === "Escape" || e.code === "Enter") {
      exitTv();
      return;
    }
    if (e.code === "ArrowLeft" || e.code === "KeyA") setTune(tune - 0.012);
    if (e.code === "ArrowRight" || e.code === "KeyD") setTune(tune + 0.012);
  });
  window.addEventListener(
    "wheel",
    (e) => {
      if (tvMode !== 2) return;
      e.preventDefault();
      setTune(tune + Math.sign(e.deltaY) * 0.018);
    },
    { passive: false }
  );
  window.addEventListener("mousedown", (e) => {
    if (tvMode !== 2) return;
    tvDrag = true;
    tvLastX = e.clientX;
  });
  window.addEventListener("mouseup", () => (tvDrag = false));
  window.addEventListener("mousemove", (e) => {
    if (tvMode !== 2 || !tvDrag) return;
    const locked = document.pointerLockElement !== null;
    const dx = locked ? e.movementX || 0 : e.clientX - tvLastX;
    tvLastX = e.clientX;
    setTune(tune + dx * 0.0016);
  });

  game.register([tvScreen], "tv", "Ver la televisión", enterTv);

  // sofá mirando a la TV
  box("sofaB", 0.9, 0.55, 2.2, 6.8, 0.28, 24, matSofa);
  box("sofaR", 0.35, 1.0, 2.2, 7.25, 0.5, 24, matSofa);
  // mesa y sillas
  box("mesa", 1.8, 0.75, 1.0, 16, 0.38, 25, matWood);
  box("silla1", 0.5, 0.9, 0.5, 15.2, 0.45, 26.2, matWood);
  box("silla2", 0.5, 0.9, 0.5, 16.8, 0.45, 23.8, matWood);
  // estantería al fondo
  box("estant", 3.4, 2.2, 0.5, 20, 1.1, 29.4, matWood);
  const libros = box("libros", 3.0, 1.6, 0.2, 20, 1.1, 29.1, matRed, { collide: false });
  game.register(libros, "libros", "Mirar la estantería", () => {
    game.notify("Biblias, crucigramas a medio hacer y un tomo de One Piece con el sello: PROPIEDAD DE LA 103.");
  });

  // nevera de la sala común (el yogur prohibido)
  const nevera = box("nevera", 0.78, 1.5, 0.7, 26.8, 0.75, 29.2, matWhite);
  game.register(nevera, "nevera", () => (state.has("yogur_pina") ? "Mirar la nevera" : "Abrir la nevera"), () => {
    if (state.has("yogur_pina")) {
      game.notify("Vacía. Solo queda el frío y una nota: REPONER. FIRMADO: EL DIRECTOR.");
      return;
    }
    state.addItem({ id: "yogur_pina", name: "Yogur de piña", desc: "En la tapa, rotulador rojo: «PARA ISMAEL. NO.» No especifica no qué. Solo NO." });
    game.sfx.pickup();
    game.notify("Has cogido un yogur de piña. Sientes que acabas de armar algo.");
  });

  // ------------------------------------------------------------- lavandería
  for (let i = 0; i < 3; i++) {
    const lav = box("lavad" + i, 0.9, 1.1, 0.9, 38.7, 0.55, 20.5 + i * 2.6, matMetal);
    game.register(lav, "lavad" + i, "Mirar la lavadora", () => {
      game.notify("El tambor está frío. Huele a lejía y a algo dulce que no deberías reconocer.");
    });
  }
  box("mesaLav", 1.6, 0.8, 0.9, 32, 0.4, 27.5, matWood);
  box("cesto", 0.8, 0.7, 0.8, 31.5, 0.35, 20, matWood);

  if (!state.has("radio") && !state.get("radio_dada")) {
    const radioRoot = new TransformNode("radioRoot", scene);
    radioRoot.position.set(38.7, 1.28, 23.1);
    const rb = box("radioB", 0.5, 0.26, 0.18, 0, 0, 0, matRadio, { collide: false });
    rb.parent = radioRoot;
    rb.position.set(0, 0, 0);
    const ant = MeshBuilder.CreateCylinder("ant", { diameter: 0.02, height: 0.5 }, scene);
    ant.position.set(0.18, 0.3, 0);
    ant.rotation.z = 0.5;
    ant.material = matMetal;
    ant.parent = radioRoot;
    game.register(rb, "radio", "Coger la radio", () => {
      state.addItem({ id: "radio", name: "Radio vieja", desc: "La radio de Nikuman. El dial está gastado de girarlo mil veces buscando algo que viciar." });
      radioRoot.dispose();
      game.sfx.pickup();
      game.notify("Has cogido la radio de Nikuman.");
      updateObjective();
    });
  }

  if (!state.has("destornillador")) {
    const dest = box("dest", 0.34, 0.05, 0.08, 32.2, 0.83, 27.4, matGold, { collide: false });
    game.register(dest, "dest", "Coger el destornillador", () => {
      state.addItem({ id: "destornillador", name: "Destornillador", desc: "Punta plana, mango agrietado. Podría abrir más cosas que tornillos." });
      dest.dispose();
      game.sfx.pickup();
      game.notify("Has cogido un destornillador. Quizá sirva más adelante.");
    });
  }

  // ------------------------------------------------------------- enfermería
  box("escrit", 1.7, 0.8, 0.9, 47, 0.4, 24, matWood);
  box("sillaEnf", 0.5, 0.95, 0.5, 47, 0.48, 25.2, matWood);
  box("camilla", 0.9, 0.7, 2.0, 50.6, 0.35, 27.5, matWhite);
  const armario = box("armario", 1.2, 2.2, 0.6, 43.2, 1.1, 28.5, matMetal);
  game.register(armario, "armario", "Abrir el armario", () => {
    game.notify("Vendas, formularios firmados por el Director... con tres caligrafías distintas. Y un guante negro, solo el izquierdo.");
  });
  const camillaI = box("camillaCorreas", 0.92, 0.06, 2.02, 50.6, 0.72, 27.5, matRed, { collide: false });
  game.register(camillaI, "camilla", "Mirar la camilla", () => {
    game.notify("Correas de cuero en las esquinas. Están gastadas. Alguien tiró muy fuerte.");
  });

  if (!state.has("llave_escalera")) {
    const llave = box("llave", 0.07, 0.03, 0.16, 46.6, 0.83, 23.8, matGold, { collide: false });
    game.register(llave, "llave", "Coger la llave", () => {
      state.addItem({ id: "llave_escalera", name: "Llave de la escalera", desc: "Etiqueta de cartón: «ESC. P2». El metal está helado." });
      llave.dispose();
      game.sfx.pickup();
      game.notify("Has cogido la llave de la escalera.");
      updateObjective();
    });
  }

  if (!state.has("expediente")) {
    const exp = box("exp", 0.32, 0.03, 0.42, 47.5, 0.83, 24.2, matPaper, { collide: false });
    game.register(exp, "exp", "Leer el expediente", () => {
      state.addItem({ id: "expediente", name: "Expediente — MATAS ADE, MARIO", desc: "Tu historia según ellos. El diagnóstico está tachado y la firma del Director no es siempre la misma." });
      exp.dispose();
      game.sfx.pickup();
      game.talk(
        {
          e1: {
            speaker: "EXPEDIENTE CLÍNICO",
            text: "«MATAS ADE, MARIO — PACIENTE Nº 0034.\nIngreso involuntario. Motero. Injerto capilar reciente.\nDiagnóstico: [tachado con tinta negra]\n\nObservaciones: inventa historias sobre los demás internos.\nSiempre segundo en todo. Nunca perdona ser segundo.\n\nFirmado: Director R. Rovira.»",
            next: "e2",
          },
          e2: {
            text: "(La firma del Director no se parece\na la de los otros informes del corcho.\nComo si la hubiera escrito otra mano.)",
          },
        },
        "e1"
      );
    });
  }

  if (!state.has("sedantes")) {
    const sed = box("sed", 0.14, 0.12, 0.1, 43.2, 2.28, 28.2, matWhite, { collide: false });
    game.register(sed, "sed", "Coger los sedantes", () => {
      state.addItem({ id: "sedantes", name: "Frasco de sedantes", desc: "«Haloperidol». Media etiqueta arrancada. Suena a gravilla al agitarlo." });
      sed.dispose();
      game.sfx.pickup();
      game.notify("Has cogido un frasco de sedantes.");
    });
  }

  // ------------------------------------------------------------- objetivos
  const updateObjective = () => {
    if (((state.get("nivel") as number) ?? 1) >= 2) return; // los llevan level2/level3
    if (state.get("nivel1_completado")) return game.setObjective("Baja por la escalera.");
    if (state.has("llave_escalera")) return game.setObjective("Abre la puerta de la escalera.");
    if (state.get("enf_open")) return game.setObjective("Busca la llave dentro de la enfermería.");
    if (state.get("codigo_sabido")) return game.setObjective("Abre la enfermería.\nCódigo: 2413.");
    if (state.has("radio")) return game.setObjective("Llévale la radio a Nikuman (sala común).");
    if (state.get("radio_quest")) return game.setObjective("Encuentra la radio de Nikuman en la lavandería.");
    if (state.get("chus_hint")) return game.setObjective("Consigue el código de la enfermería.\nNikuman sabe de números (sala común).");
    if (state.get("ortiz_hint") || state.get("vio_puerta")) return game.setObjective("La escalera está cerrada.\nLa llave está en la enfermería.");
    if (state.get("salio_celda")) return game.setObjective("Explora la planta.\nBusca la escalera.");
    return game.setObjective("Sal de tu habitación.");
  };
  updateObjective();

  // subir de vuelta desde la planta 1 (aparece junto a la puerta de la escalera)
  game.enterLevel1 = async () => {
    if (((state.get("nivel") as number) ?? 1) === 1) return;
    game.playing = false;
    game.player.setControl(false);
    await hud.fade(true, 1000);
    state.set("nivel", 1);
    placeLights1();
    const cam = game.player.camera;
    cam.position.set(60.5, 1.62, 27.5);
    cam.rotation.set(0, Math.PI, 0);
    updateObjective();
    hud.setLocation("PLANTA 2 · ALA B");
    game.savePlayer();
    game.playing = true;
    game.player.setControl(true);
    await hud.fade(false, 900);
    game.checkPause();
    game.notify("De vuelta en la planta 2. El pasillo sigue conteniendo la respiración.");
  };

  let salioCheck = !state.get("salio_celda");
  game.onUpdate.push(() => {
    if (((state.get("nivel") as number) ?? 1) >= 2) return;
    if (salioCheck && game.player.camera.position.z > 9.6) {
      salioCheck = false;
      if (!state.get("salio_celda")) {
        state.set("salio_celda");
        updateObjective();
        game.notify("El pasillo está en silencio. Demasiado.");
      }
    }
  });

  // ------------------------------------------------------------- PNJs
  // BARTOLO — celador del turno de noche, sala común
  const bartolo = createNPC(scene, {
    name: "Bartolo",
    position: new Vector3(8.6, 0, 21.5),
    yaw: -2.1,
    shirt: "#3d4a55",
    pants: "#2c3138",
    skin: "#b08a6a",
    scale: 1.06,
  });
  const bartoloTree = (): DTree => ({
    start: {
      speaker: "BARTOLO — CELADOR",
      text: () =>
        state.get("ortiz_talked")
          ? "¿Sigues dando vueltas, Matas? El que no duerme acaba oyendo la campana."
          : "¡Matas! Son casi las cuatro de la mañana.\n¿Qué haces fuera de tu habitación?\nComo vomites en mi turno, friego yo. Y si friego yo, te ato al catre.",
      action: () => state.set("ortiz_talked"),
      options: [
        { label: "Mi puerta estaba abierta.", next: "puerta" },
        { label: "¿Cómo se baja de esta planta?", next: "salir" },
        { label: "Quiero hablar con el Director.", next: "director" },
        { label: "Nada. Perdón.", next: "nada" },
      ],
    },
    puerta: {
      text: "¿Abierta?\nImposible. Yo mismo cerré todas las puertas a las diez.\nYo. Mismo. Las. Cerré.",
      next: "puerta2",
    },
    puerta2: {
      text: "...Vuelve a la 104, Matas. Esta noche el edificio está nervioso.\nY no me toques el televisor.",
    },
    salir: {
      text: "¿Bajar? La escalera lleva cerrada desde lo del tercer turno.\nLa llave está en la enfermería, con los expedientes.\nY la enfermería, de noche, se cierra sola. Órdenes de arriba.",
      action: () => {
        state.set("ortiz_hint");
        updateObjective();
      },
    },
    director: {
      text: "Ja. Eso lo decide el Director Rovira.\nY el Director no sube a esta planta...",
      next: "director2",
    },
    director2: {
      text: "...aunque algunos dicen que en realidad\nnunca ha salido de ella.\n\nYo no digo nada. Yo friego.",
      action: () => state.set("oyo_rovira"),
    },
    nada: {
      text: "Eso pensaba.\nSiéntate a ver la tele si quieres. Esta noche solo hay estática.\nComo todas las noches.",
    },
  });
  game.register(bartolo.hit, "npcBartolo", "Hablar con Bartolo", () => game.talk(bartoloTree(), "start"));
  minimap.trackNpc(1, () => ({ x: bartolo.root.position.x, z: bartolo.root.position.z }));

  // NIKUMAN — paciente, sala común (el pullador; sin PC, sin QT, sin radio)
  const nikuman = createNPC(scene, {
    name: "Nikuman",
    position: new Vector3(25, 0, 27.5),
    yaw: -2.6,
    shirt: "#7d8a7b",
    pants: "#6d6a5f",
    skin: "#c29a78",
    hair: "#4a3a2a",
    scale: 0.97,
    barefoot: true,
    glasses: true,
  });
  const yogurOption = {
    label: "Enseñarle el yogur de piña.",
    next: "yogur",
    condition: () => state.has("yogur_pina") && !state.get("nikuman_encanado"),
  };
  const yogurNodes: DTree = {
    yogur: {
      text: "¿Eso es...? ¿YOGUR?\n¿DE PIÑA?\n¡¿QUIÉN TE HA DICHO LO DEL YOGUR?!\n¡FUE LA MANO NEGRA, ¿VERDAD?! ¡SIEMPRE ES LA MANO NEGRA!",
      next: "yogur2",
      action: () => state.set("nikuman_encanado"),
    },
    yogur2: {
      text: "(Nikuman se queda mirando la pared, respirando fuerte.)\n(Se ha encanado. Mejor guardar el yogur para otro momento.)",
    },
  };
  const nikumanTree = (): DTree => {
    if (state.get("codigo_sabido"))
      return {
        start: {
          speaker: "NIKUMAN",
          text: "Dos, cuatro, uno, tres...\nLa radio tapa las voces. Pero a la campana no la tapa nada.\nY tú a lo tuyo, que la Mano Negra no descansa.",
          options: [yogurOption, { label: "Me voy." }],
        },
        ...yogurNodes,
      };
    if (state.has("radio"))
      return {
        start: {
          speaker: "NIKUMAN",
          text: "¡La tienes! La oigo desde aquí. Dámela, dámela...",
          options: [
            { label: "Darle la radio.", next: "gracias" },
            { label: "Todavía no.", next: "no" },
          ],
        },
        gracias: {
          text: "Chsss... ¿oyes? Estática.\nComo la tele. Es la misma voz en todas partes.\nMenos da una piedra. Y aquí hasta las piedras están fichadas.",
          next: "secreto",
          action: () => {
            state.removeItem("radio");
            state.set("radio_dada");
            const r = box("radioNikuman", 0.5, 0.26, 0.18, 25.4, 0.13, 27.2, matRadio, { collide: false });
            r.rotation.y = 0.7;
          },
        },
        secreto: {
          text: "Los números. Sí. Te los debo, MM.\nVi a Bartolo marcar el código de la enfermería\nun día que venía de fregar:\nDOS... CUATRO... UNO... TRES.\nCauntu lo llamaría memoria eidética. Yo lo llamo talento.\nSoy el brujo número uno del PoE.",
          action: () => {
            state.set("codigo_sabido");
            updateObjective();
          },
        },
        no: { text: "...Elizabeth también me dijo eso una vez.\nLuego se llevó los gatos al QT. Los CUATRO.\nO cinco. Nadie ha conseguido contarlos." },
      };
    if (state.get("radio_quest"))
      return {
        start: {
          speaker: "NIKUMAN",
          text: "La lavandería. Las máquinas. Encima de una máquina.\nTráela. Aquí sin viciar se oye TODO.",
        },
      };
    return {
      start: {
        speaker: "NIKUMAN",
        text: "¿Vienes a pullarme o a robarme, MM? Porque ya me lo han quitado TODO.\nEl PC. Los gatos. El QT... bueno, el QT me lo quitaron a favor.\nY la radio. Me quitaron hasta la radio.",
        options: [
          { label: "¿Quién te quitó la radio?", next: "mano" },
          yogurOption,
          { label: "Déjame en paz.", next: "paz" },
        ],
      },
      mano: {
        text: "La Mano Negra. Kuroi Te. El que firma como 'Director'.\nBartolo dice que fue 'orden de arriba'. JA.\nLa dejaron en la lavandería, encima de una máquina.",
        next: "mano2",
      },
      mano2: {
        text: "Tráemela y te pago con lo único que me queda:\nnúmeros. De los buenos.",
        action: () => {
          state.set("radio_quest");
          updateObjective();
        },
      },
      paz: {
        text: "Todos dicen eso.\nJorge no. Jorge jamás me lo diría.\nMi amigo del alma. Mi amado Jorge.\nÉl me habría impreso una radio nueva con su impresora.",
      },
      ...yogurNodes,
    };
  };
  game.register(nikuman.hit, "npcNikuman", "Hablar con Nikuman", () => game.talk(nikumanTree(), "start"));
  minimap.trackNpc(1, () => ({ x: nikuman.root.position.x, z: nikuman.root.position.z }));

  // EL CHUS — paciente, pasillo (experto casual en fugas)
  const chus = createNPC(scene, {
    name: "Chus",
    position: new Vector3(24, 0, 13.5),
    yaw: 1.5,
    shirt: "#8a5a72",
    pants: "#5c5560",
    skin: "#caa88c",
    hair: "#151210",
    scale: 0.98,
    ponytail: true,
  });
  const chusTree = (): DTree => {
    if (state.get("chus_hint"))
      return {
        start: {
          speaker: "EL CHUS",
          text: "¿Sigues aquí? Tic, tac.\nCuando bajes, si hay fiesta en la planta baja... no era yo.\nBueno, igual sí era yo.",
        },
      };
    return {
      start: {
        speaker: "EL CHUS",
        text: "Shhh. ¿Oyes la campana de abajo?\nEn todos los sitios de los que me he fugado había una igual.\nY créeme: me he fugado de unos cuantos.",
        options: [
          { label: "¿Quién eres?", next: "quien" },
          { label: "Necesito llegar a la escalera.", next: "escalera" },
          { label: "Tengo que irme.", next: "irse" },
        ],
      },
      quien: {
        text: "Chus. 'Chusti Wild' en según qué ambientes.\nMe he escapado de tres manicomios, dos bodas y una mili.\nEste sería el cuarto. Bueno, el cuarto manicomio. Las bodas van aparte.",
        next: "start2",
      },
      start2: {
        text: "¿Y tú qué, Radd? ¿Esta noche toca fuga?\nLo digo por apuntarme. Por costumbre, más que nada.",
        options: [
          { label: "Necesito llegar a la escalera.", next: "escalera" },
          { label: "Nada. Buenas noches.", next: "irse" },
        ],
      },
      escalera: {
        text: "La puerta de la escalera está cerrada con llave.\nRegla número uno de toda fuga: la llave siempre está\ndonde más rabia da. Aquí: en la enfermería, con los expedientes.",
        next: "escalera2",
      },
      escalera2: {
        text: "Y la enfermería tiene teclado de números.\nA mí los números se me dan regular: yo soy más de ventanas.\nA Nikuman se le dan DEMASIADO bien. Está en la sala común, echando pestes.",
        action: () => {
          state.set("chus_hint");
          updateObjective();
        },
      },
      irse: {
        text: "Tú mismo.\nSi cambias de idea, silba dos veces.\nNo significa nada, pero queda profesional.",
      },
    };
  };
  game.register(chus.hit, "npcChus", "Hablar con el Chus", () => game.talk(chusTree(), "start"));
  minimap.trackNpc(1, () => ({ x: chus.root.position.x, z: chus.root.position.z }));

  // MONTREAL (EDU) — paciente, habitación 103
  const montreal = createNPC(scene, {
    name: "Montreal",
    position: new Vector3(21, 0, 4.5),
    yaw: 2.9,
    shirt: "#847a68",
    pants: "#4f4a42",
    skin: "#b59274",
    hair: "#2a221a",
    scale: 0.95,
  });
  const montrealTree = (): DTree => ({
    start: {
      speaker: "MONTREAL",
      text: "Hombre, Ema. El mismísimo Ema, el de la 104.\nYo soy Edu. 'Montreal' para los del grupo.\nNADA que ver con Canadá, que conste.",
      options: [
        { label: "¿Tú no quieres escaparte?", next: "fuga" },
        { label: "¿Has oído algo raro esta noche?", next: "raro" },
        { label: "Hasta luego.", next: "adios" },
      ],
    },
    fuga: {
      text: "¿Fugarme? ¿Con lo que me queda de One Piece?\nAquí hay catre, silencio y nadie me manda vigilar pasillos.\nComparado con el Carrefour, esto es un balneario.",
      next: "fuga2",
    },
    fuga2: {
      text: "Además, el que vigila de noche soy yo.\nBueno, vigilaba. Antes de ser... cliente.\nLa frontera es más fina de lo que parece.",
    },
    raro: {
      text: "La megafonía ha dicho tu nombre dos veces.\nCon una voz rara. Como de sillón vacío.\nYo ni caso: aquí los altavoces sueñan en alto.",
      next: "raro2",
    },
    raro2: {
      text: "...Pero si yo fuera tú, bajaría\nantes de que lo diga la tercera.",
      action: () => state.set("edu_aviso"),
    },
    adios: {
      text: "Venga.\nSi ves a uno gritándole a un yogur, dile que baje la voz,\nque hay gente leyendo.",
    },
  });
  game.register(montreal.hit, "npcMontreal", "Hablar con Montreal", () => game.talk(montrealTree(), "start"));
  minimap.trackNpc(1, () => ({ x: montreal.root.position.x, z: montreal.root.position.z }));
}
