import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Ray,
  StandardMaterial,
  Texture,
  Vector3,
} from "@babylonjs/core";
import { colorMat, grimeTexture, texMat } from "../core/textures";
import { hud } from "../ui/hud";
import { minimap } from "../ui/minimap";
import { Game } from "./Game";
import { installMirror } from "./mirror";
import { ItemDef } from "./state";
import { createNPC, NPC } from "./npc";

const T = 2;
const WALL_H = 3;
const Z_OFF = 180;

// ALA C: anillo de pasillos, celdas, sala de celadores, comedor, dormitorio,
// almacén, sala de máquinas y la escalera de la azotea.
const MAP4 = [
  "##############################",
  "#...#...#...#...#............#",
  "#...#...#...#...#............#",
  "#...#...#...#...#............#",
  "##.###.###.###.#######.#######",
  "#............................#",
  "#............................#",
  "#..#####.###########.######..#",
  "#..#..........#...........#..#",
  "#..#..........#...........#..#",
  "#..#..........#...........#..#",
  "#..#..........#...........#..#",
  "#..#..........#...........#..#",
  "#..#..........#...........#..#",
  "#..#..........#...........#..#",
  "#..#..........#...........#..#",
  "#..#..........#...........#..#",
  "#..########.#####.#########..#",
  "#............................#",
  "#............................#",
  "####.########.##########.#####",
  "#........#........#..........#",
  "#........#........#..........#",
  "#........#........#..........#",
  "#........#........#..........#",
  "##############################",
];

const cz = (r: number) => (r + 0.5) * T + Z_OFF;
const lerpAngle = (a: number, b: number, k: number) => {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
};

interface Ruta {
  x: number;
  z: number;
  w?: number;
  a?: string;
}

interface Celador {
  nombre: string;
  npc: NPC;
  col: Mesh;
  ruta: Ruta[];
  idx: number;
  yaw: number;
  estado: "ronda" | "espera" | "caza" | "busca";
  esperaHasta: number;
  buscaHasta: number;
  lastSeen: Vector3;
  lastLOS: number;
  spotObjetivo: Vector3 | null;
  target: Vector3;
  loot: ItemDef;
  lootFlag: string;
}

export function buildLevel4(game: Game) {
  const scene = game.scene;
  const state = game.state;

  // ------------------------------------------------------------- materiales
  const matWall = texMat(scene, "wall4", grimeTexture(scene, "wallT4", { base: "#5a6156", stains: 14, zocalo: "#31352d" }));
  const matFloor = texMat(
    scene,
    "floor4",
    grimeTexture(scene, "floorT4", { base: "#48463f", tiles: 2, speckle: 4600, stains: 14 }),
    MAP4[0].length,
    MAP4.length
  );
  const matCeil = texMat(scene, "ceil4", grimeTexture(scene, "ceilT4", { base: "#262521", speckle: 2800, stains: 14 }), MAP4[0].length, MAP4.length);
  const matFrame = colorMat(scene, "frame4", "#2b2d27");
  const matWood = texMat(scene, "wood4", grimeTexture(scene, "woodT4", { base: "#4e3f2c", planks: true, speckle: 1600 }));
  const matMetal = texMat(scene, "metal4", grimeTexture(scene, "metalT4", { base: "#666b6e", speckle: 2000, stains: 8 }));
  const matLocker = texMat(scene, "locker4", grimeTexture(scene, "lockerT4", { base: "#4c5a52", speckle: 2200, stains: 8 }));
  const matLockerD = colorMat(scene, "lockerD4", "#3c4841");
  const matPaper = colorMat(scene, "paper4", "#d6d0be", 0.12);
  const matDark = colorMat(scene, "dark4", "#232326");
  const matWhite = colorMat(scene, "white4", "#a8a59a");
  const matRed = colorMat(scene, "red4", "#7a2a22", 0.25);

  // ------------------------------------------------------------- geometría
  const boxes: Mesh[] = [];
  for (let r = 0; r < MAP4.length; r++) {
    for (let c = 0; c < MAP4[r].length; c++) {
      if (MAP4[r][c] !== "#") continue;
      let nearFloor = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (MAP4[r + dr]?.[c + dc] === ".") nearFloor = true;
        }
      }
      if (!nearFloor) continue;
      const b = MeshBuilder.CreateBox("w4", { width: T, height: WALL_H, depth: T }, scene);
      b.position.set((c + 0.5) * T, WALL_H / 2, cz(r));
      boxes.push(b);
    }
  }
  const walls = Mesh.MergeMeshes(boxes, true, true)!;
  walls.name = "walls4";
  walls.material = matWall;
  walls.checkCollisions = true;
  walls.freezeWorldMatrix();
  minimap.register(4, MAP4, Z_OFF);

  const W = MAP4[0].length * T;
  const H = MAP4.length * T;
  const ground = MeshBuilder.CreateGround("ground4", { width: W, height: H }, scene);
  ground.position.set(W / 2, 0, Z_OFF + H / 2);
  ground.material = matFloor;
  ground.checkCollisions = true;
  const ceil = MeshBuilder.CreateGround("ceil4", { width: W, height: H }, scene);
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
    const texW = Math.max(128, text.length * 23 + 40);
    const dt = new DynamicTexture("sg4_" + text, { width: texW, height: 64 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
    dt.drawText(text, null, 44, "bold 38px 'Courier New'", fg, bg, true);
    const m = new StandardMaterial("sgm4_" + text, scene);
    m.diffuseTexture = dt;
    m.emissiveTexture = dt;
    m.emissiveColor = new Color3(0.55, 0.55, 0.55);
    m.specularColor = Color3.Black();
    const p = MeshBuilder.CreatePlane("sgp4_" + text, { width: w, height: w * (64 / texW), sideOrientation: Mesh.DOUBLESIDE }, scene);
    p.position.set(x, y, z);
    p.rotation.y = faceRy + Math.PI;
    p.material = m;
    return p;
  };

  // dinteles en todos los vanos
  const lintel = (x: number, z: number, ry = 0) => {
    const l = box("lint4", 2.1, 0.55, 0.34, x, 2.76, z, matFrame);
    l.rotation.y = ry;
  };
  for (const [x, z] of [
    [5, 189], [13, 189], [21, 189], [29, 189], [45, 189],
    [17, 195], [41, 195], [23, 215], [35, 215],
    [9, 221], [27, 221], [49, 221],
  ]) {
    lintel(x, z);
  }

  sign("SALA DE CELADORES", 45, 2.62, 189.9, 0, "#d8e8f0", "#1d2a30", 2.6);
  sign("COMEDOR", 17, 2.62, 195.9, 0);
  sign("DORMITORIO", 41, 2.62, 195.9, 0);
  sign("ALMACÉN", 9, 2.62, 221.9, 0);
  sign("MÁQUINAS", 27, 2.62, 221.9, 0);
  sign("AZOTEA →", 49, 2.62, 221.9, 0, "#9fe89f", "#0d2010", 1.7);
  for (let i = 0; i < 4; i++) sign("C-0" + (i + 1), 5 + i * 8, 2.62, 190.1, Math.PI, "#cfc9b8", "#20221f", 0.9);

  // puerta de entrada (por la que llegas del Archivo), oeste
  box("entFrame4", 0.16, 2.6, 2.1, 2.08, 1.3, 191, matFrame);
  const entDoor = box("entDoor4", 0.12, 2.48, 1.7, 2.06, 1.24, 191, matDark);
  game.register(entDoor, "entDoor4", "Puerta del Archivo", () => {
    game.sfx.locked();
    game.notify("Cerrada. Aquí ya solo se sale por arriba.");
  });

  // ------------------------------------------------------------- escondites
  interface Escondite {
    tipo: "armario" | "mesa";
    dentro: Vector3;
    salida: Vector3;
  }
  let escondido: Escondite | null = null;
  let armarioN = 0;

  const esconder = (e: Escondite) => {
    if (escondido || game.uiBlocked() || state.get("nivel") !== 4) return;
    const now = performance.now();
    // si alguien te está viendo (o te acaba de ver), sabe dónde te metes
    for (const g of celadores) {
      if (g.estado === "caza" && now - g.lastLOS < 1400) g.spotObjetivo = e.salida.clone();
    }
    escondido = e;
    game.modal = true;
    game.player.setControl(false);
    game.player.lockY = false;
    const cam = game.player.camera;
    cam.position.set(e.dentro.x, e.dentro.y, e.dentro.z);
    const ui = document.getElementById("hide-ui")!;
    ui.classList.remove("hidden");
    ui.classList.toggle("mesa", e.tipo === "mesa");
    game.sfx.doorCreak();
  };

  const salirEscondite = (silencioso = false) => {
    if (!escondido) return;
    const cam = game.player.camera;
    cam.position.set(escondido.salida.x, 1.62, escondido.salida.z);
    escondido = null;
    game.modal = false;
    game.player.lockY = true;
    document.getElementById("hide-ui")!.classList.add("hidden");
    if (!silencioso) {
      game.player.setControl(true);
      game.sfx.doorCreak();
    }
  };

  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyE" && escondido && state.get("nivel") === 4 && game.playing && !game.dialogue.isOpen) {
      salirEscondite();
    }
  });

  const mkArmario = (x: number, z: number, ry: number) => {
    const id = "armario4_" + armarioN++;
    const cuerpo = box("armC" + id, 0.95, 2.1, 0.7, x, 1.05, z, matLocker, { ry });
    const dirx = Math.sin(ry);
    const dirz = Math.cos(ry);
    const puerta = box("armP" + id, 0.85, 1.9, 0.06, x + dirx * 0.36, 1.02, z + dirz * 0.36, matLockerD, { ry, collide: false });
    puerta.isPickable = true;
    game.register(
      [cuerpo, puerta],
      id,
      "Esconderse en el armario",
      () =>
        esconder({
          tipo: "armario",
          dentro: new Vector3(x + dirx * 0.12, 1.45, z + dirz * 0.12),
          salida: new Vector3(x + dirx * 1.15, 0, z + dirz * 1.15),
        }),
      () => state.get("nivel") === 4 && !escondido
    );
  };

  const mkMesaHueco = (x: number, z: number, ry = 0) => {
    const id = "mesa4_" + armarioN++;
    const tab = box("mesaT" + id, 1.8, 0.09, 1.0, x, 0.8, z, matWood, { ry });
    for (const [px, pz] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) {
      const c = Math.cos(ry);
      const s = Math.sin(ry);
      box("mesaP" + id, 0.09, 0.78, 0.09, x + px * c + pz * s, 0.39, z - px * s + pz * c, matWood, { collide: false });
    }
    game.register(
      tab,
      id,
      "Esconderse bajo la mesa",
      () =>
        esconder({
          tipo: "mesa",
          dentro: new Vector3(x, 0.5, z),
          salida: new Vector3(x + Math.sin(ry) * 1.5, 0, z + Math.cos(ry) * 1.5),
        }),
      () => state.get("nivel") === 4 && !escondido
    );
  };

  // ------------------------------------------------------------- mobiliario
  // celdas
  for (let i = 0; i < 4; i++) {
    const bx = 3.2 + i * 8;
    box("cama4_" + i, 1.0, 0.32, 2.0, bx, 0.16, 184, matMetal);
    box("colchon4_" + i, 0.94, 0.14, 1.94, bx, 0.39, 184, matWhite, { collide: false });
  }
  const camaC1 = box("camaC1i", 0.9, 0.05, 1.9, 3.2, 0.47, 184, matWhite, { collide: false });
  game.register(camaC1, "camaC1", "Tocar el colchón", () => {
    game.notify("Aún está caliente. Alguien dormía aquí hasta hace un momento.");
  });

  // sala de celadores
  mkMesaHueco(46, 185.5);
  box("sillasCel1", 0.5, 0.95, 0.5, 44.5, 0.48, 184.3, matWood);
  box("sillasCel2", 0.5, 0.95, 0.5, 47.5, 0.48, 186.8, matWood);
  mkArmario(35, 183.2, Math.PI); // taquilla de la sala
  const tablon = box("tablon4", 1.8, 1.1, 0.06, 41, 1.75, 182.12, matWood, { collide: false });
  game.register(tablon, "tablon4", "Leer el tablón de celadores", () => {
    state.set("tablon_visto");
    updateObjective4();
    game.talk(
      {
        t1: {
          speaker: "TABLÓN DE CELADORES",
          text: "«TURNOS DE AZOTEA: SOLO GUZMÁN.\nLA TARJETA ROJA NO SE PRESTA. NO INSISTÁIS.»",
          next: "t2",
        },
        t2: {
          text: "Debajo, en bolígrafo furioso:\n«GUZMÁN: o dejas de subirte a FUMAR a la sala de\nmáquinas en mitad de la ronda, o el Director\nte archiva a ti también.»",
          next: "t3",
        },
        t3: {
          text: "(Guzmán. Tarjeta roja. Fuma en la sala de máquinas.\nEso es una rutina... y una oportunidad.)",
        },
      },
      "t1"
    );
  });

  // el plano del ala, en la mesa de los celadores
  if (!state.has("mapa4")) {
    const mapa4M = box("mapa4", 0.36, 0.015, 0.28, 47.2, 0.87, 185.3, matPaper, { collide: false });
    mapa4M.rotation.y = 0.5;
    game.register(mapa4M, "mapa4", "Coger el plano del ala C", () => {
      state.addItem({
        id: "mapa4",
        name: "Plano — Ala C",
        desc: "El plano de las rondas. Tiene horarios tachados y un círculo en la azotea con tres signos de interrogación.",
      });
      mapa4M.dispose();
      game.sfx.pickup();
      game.notify("Has cogido el plano del ala C.");
    });
  }

  // comedor
  mkMesaHueco(12, 202);
  mkMesaHueco(20, 207, Math.PI / 2);
  mkMesaHueco(12, 211);
  box("bancoCom1", 2.0, 0.5, 0.5, 16, 0.25, 202, matWood);
  const notaCom = box("notaCom", 0.28, 0.012, 0.36, 20.3, 0.86, 206.8, matPaper, { collide: false });
  game.register(notaCom, "notaCom", "Leer la nota clavada", () => {
    state.set("nota_azotea");
    game.talk(
      {
        n1: {
          speaker: "CIRCULAR INTERNA",
          text: "«PROHIBIDO comentar el ala que se ve desde la azotea.\nNO existe.\nDejad de dibujarla en los partes.»",
        },
      },
      "n1"
    );
  });
  mkArmario(9, 212.6, -Math.PI / 2);

  // dormitorio
  const muebleDorm: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    muebleDorm.push(box("camaD" + i, 1.0, 0.32, 2.0, 33 + (i % 2) * 14, 0.16, 200 + Math.floor(i / 2) * 8, matMetal));
    muebleDorm.push(
      box("colchD" + i, 0.94, 0.14, 1.94, 33 + (i % 2) * 14, 0.39, 200 + Math.floor(i / 2) * 8, matWhite, { collide: false })
    );
  }
  mkMesaHueco(42, 211);
  mkArmario(51, 199, -Math.PI / 2);

  // espejo de aseo del dormitorio (pared este)
  const lavaboDorm = box("lavaboDorm", 0.5, 0.5, 0.7, 51.6, 0.85, 206, matWhite);
  const espejoDorm = box("espejoDorm", 0.06, 0.95, 1.5, 51.85, 1.8, 206, matMetal, { collide: false });
  installMirror(game, {
    mesh: espejoDorm,
    normal: new Vector3(-1, 0, 0),
    extra: [walls, ground, ceil, lavaboDorm, ...muebleDorm],
    nivel: 4,
    tint: "#14181b",
  });
  game.register(espejoDorm, "espejoDorm", "Mirarte al espejo", () => {
    game.talk(
      {
        d1: {
          speaker: "ESPEJO DEL ALA C",
          text: "Un espejo pequeño, con el azogue comido por los bordes.\nAhí estás: el paciente 0034, de madrugada,\ndonde no deberías estar.",
          next: "d2",
        },
        d2: {
          text: "(A tu espalda, en el reflejo, las camas están hechas.\nTodas.\nEn un ala donde, supuestamente, no duerme nadie.)",
          action: () => state.set("espejo_alac"),
        },
      },
      "d1"
    );
  });

  // almacén
  box("estAlm4a", 0.5, 2.2, 4.0, 2.6, 1.1, 226, matMetal);
  box("cajasAlm4", 1.2, 1.1, 1.2, 12, 0.55, 228, matWood);
  box("cajasAlm4b", 0.9, 0.8, 0.9, 12.3, 1.5, 228, matWood);
  mkArmario(16.5, 227.5, -Math.PI / 2);

  // sala de máquinas
  box("caldera4", 3.0, 2.4, 1.6, 30, 1.2, 228.4, matMetal);
  box("tubo4", 0.25, 2.8, 0.25, 28.6, 1.4, 227.6, matMetal);
  box("tubo4b", 0.25, 2.8, 0.25, 31.4, 1.4, 227.6, matMetal);
  const caldera = box("calderaI4", 3.02, 0.4, 1.62, 30, 1.9, 228.4, matRed, { collide: false });
  game.register(caldera, "caldera4", "Mirar la caldera", () => {
    game.notify("Ruge bajito, como si masticara. Junto a la rejilla hay un cenicero escondido lleno de colillas.");
  });
  mkMesaHueco(22, 224.5);
  mkArmario(35, 223.4, Math.PI);

  // pasillos: taquillas sueltas
  mkArmario(7, 190.7, 0);
  mkArmario(50, 219.4, Math.PI);
  mkArmario(2.7, 205, Math.PI / 2);

  // escalera azotea
  box("peld1", 3.0, 0.25, 1.2, 48, 0.125, 224, matMetal);
  box("peld2", 3.0, 0.25, 1.2, 48, 0.375, 225.2, matMetal);
  box("peld3", 3.0, 0.25, 1.2, 48, 0.625, 226.4, matMetal);
  mkArmario(40, 223.4, Math.PI);

  // puerta de la azotea con lector de tarjeta
  box("azFrameL", 0.16, 2.6, 0.32, 48.05, 1.3, 229.9, matFrame);
  box("azFrameR", 0.16, 2.6, 0.32, 49.95, 1.3, 229.9, matFrame);
  const azDoor = box("azDoor", 1.7, 2.48, 0.12, 49, 1.24, 229.94, matMetal);
  sign("AZOTEA", 49, 2.62, 229.86, Math.PI, "#9fe89f", "#0d2010", 1.3);
  const lector = box("lector4", 0.16, 0.24, 0.07, 50.6, 1.3, 229.88, matDark, { collide: false });
  const luzLector = box("lectorLuz", 0.06, 0.05, 0.03, 50.6, 1.4, 229.84, matRed, { collide: false });
  game.register([azDoor, lector, luzLector], "azotea", () => (state.has("tarjeta_roja") ? "Pasar la TARJETA ROJA" : "Puerta de la azotea"), () => {
    if (!state.has("tarjeta_roja")) {
      game.sfx.locked();
      state.set("vio_azotea");
      updateObjective4();
      game.notify("El lector parpadea en rojo. «TARJETA ROJA — SOLO PERSONAL AUTORIZADO.»");
      return;
    }
    game.sfx.unlock();
    (luzLector.material as StandardMaterial).diffuseColor = Color3.FromHexString("#3a9a4a");
    (luzLector.material as StandardMaterial).emissiveColor = Color3.FromHexString("#3a9a4a").scale(0.6);
    state.set("nivel3_completado");
    setTimeout(() => {
      game.endLevel(
        "La tarjeta roja parpadeó en verde por primera vez en años.\n" +
          "El viento de la azotea olía a tormenta y a libertad prestada.\n" +
          "Desde arriba, San José parecía más grande que por dentro.\n" +
          "Como si el edificio creciera hacia abajo, hacia el ala\nque nadie dibuja en los planos.\n\n" +
          "La campana no sonó.\nY eso fue lo más inquietante de todo.\n\n" +
          "FIN DEL EPISODIO 3\n— continuará —"
      );
    }, 1200);
  });

  // ------------------------------------------------------------- celadores
  const defs: { nombre: string; shirt: string; loot: ItemDef; lootFlag: string; ruta: Ruta[] }[] = [
    {
      nombre: "GUZMÁN",
      shirt: "#3d4a55",
      loot: { id: "tarjeta_roja", name: "Tarjeta roja — AZOTEA", desc: "«ACCESO AZOTEA — G.» Grasienta, doblada y calentita del bolsillo. Abre la única puerta que mira al cielo." },
      lootFlag: "rob_guzman",
      ruta: [
        { x: 46, z: 183.5, w: 8, a: "hojea el parte" },
        { x: 45, z: 189 },
        { x: 45, z: 192 },
        { x: 56, z: 192 },
        { x: 56, z: 218 },
        { x: 27, z: 218 },
        { x: 27, z: 222 },
        { x: 28.6, z: 226.6, w: 11, a: "fuma junto a la caldera" },
        { x: 27, z: 222 },
        { x: 27, z: 218 },
        { x: 56, z: 218 },
        { x: 56, z: 192 },
        { x: 45, z: 192 },
        { x: 45, z: 189 },
      ],
    },
    {
      nombre: "PINTO",
      shirt: "#46525c",
      loot: { id: "fotos_nikuman", name: "Fotos dedicadas de Nikuman", desc: "«Para mi fan número 1 — Nikux». Nadie se las pidió. Hay siete. Todas iguales." },
      lootFlag: "rob_pinto",
      ruta: [
        { x: 56, z: 192, w: 3, a: "bosteza con violencia" },
        { x: 56, z: 218 },
        { x: 30, z: 218, w: 3, a: "comprueba una puerta ya comprobada" },
        { x: 4, z: 218 },
        { x: 4, z: 205 },
        { x: 4, z: 192, w: 3, a: "mira por una ventana que no existe" },
        { x: 30, z: 192 },
      ],
    },
    {
      nombre: "SOSA",
      shirt: "#3a4550",
      loot: { id: "cd_juegos", name: "CD quemado: «JUEGOS»", desc: "Escrito a rotulador. Debajo, más pequeño: «no son virus, confía». Confiscado a saber a quién." },
      lootFlag: "rob_sosa",
      ruta: [
        { x: 17, z: 192 },
        { x: 17, z: 198 },
        { x: 12.5, z: 203.4, w: 9, a: "recuenta los cubiertos" },
        { x: 17, z: 198 },
        { x: 17, z: 192 },
        { x: 5, z: 192 },
        { x: 5, z: 185, w: 5, a: "husmea en la celda C-01" },
        { x: 5, z: 191 },
      ],
    },
    {
      nombre: "MOLINA",
      shirt: "#414b44",
      loot: { id: "calzones_paquito", name: "Calzoncillos de Paquito (usados)", desc: "Talla BESTIA. Confiscados «por seguridad estructural». Nadie los ha reclamado. Nadie lo hará." },
      lootFlag: "rob_molina",
      ruta: [
        { x: 41, z: 192 },
        { x: 41, z: 198 },
        { x: 44.6, z: 204.4, w: 7, a: "estira sábanas que nadie usa" },
        { x: 35, z: 210 },
        { x: 35, z: 218 },
        { x: 9, z: 218 },
        { x: 9, z: 224 },
        { x: 5.5, z: 227, w: 9, a: "hace inventario de nada" },
        { x: 9, z: 224 },
        { x: 9, z: 218 },
        { x: 35, z: 218 },
        { x: 35, z: 210 },
        { x: 41, z: 198 },
      ],
    },
  ];

  const celadores: Celador[] = defs.map((d) => {
    const npc = createNPC(scene, {
      name: "cel_" + d.nombre,
      position: new Vector3(d.ruta[0].x, 0, d.ruta[0].z),
      yaw: 0,
      shirt: d.shirt,
      pants: "#2c3138",
      skin: "#b08a6a",
      scale: 1.05,
      manualYaw: true,
    });
    npc.hit.checkCollisions = false;
    const col = MeshBuilder.CreateBox("colCel_" + d.nombre, { width: 0.6, height: 1.7, depth: 0.6 }, scene);
    col.position.set(d.ruta[0].x, 0.9, d.ruta[0].z);
    col.visibility = 0;
    col.isPickable = false;
    col.ellipsoid = new Vector3(0.34, 0.8, 0.34);
    const g: Celador = {
      nombre: d.nombre,
      npc,
      col,
      ruta: d.ruta,
      idx: 0,
      yaw: 0,
      estado: "ronda",
      esperaHasta: 0,
      buscaHasta: 0,
      lastSeen: new Vector3(),
      lastLOS: 0,
      spotObjetivo: null,
      target: new Vector3(d.ruta[0].x, 0, d.ruta[0].z),
      loot: d.loot,
      lootFlag: d.lootFlag,
    };
    // robo de bolsillo: solo por la espalda y mientras está distraído
    game.register(
      npc.hit,
      "rob_" + d.nombre,
      () => `Robarle el bolsillo a ${d.nombre}`,
      () => {
        if (!state.get(g.lootFlag)) {
          state.set(g.lootFlag);
          state.addItem(g.loot);
          game.sfx.pickup();
          game.notify(`Le vacías el bolsillo a ${d.nombre}: ${g.loot.name}.`);
          updateObjective4();
        } else {
          game.notify("Sus bolsillos ya solo llevan pelusa.");
        }
      },
      () => puedeRobarse(g)
    );
    return g;
  });

  const puedeRobarse = (g: Celador) => {
    if (state.get("nivel") !== 4 || escondido || g.estado !== "espera") return false;
    const wp = g.ruta[g.idx];
    if (!wp?.a) return false; // solo cuando está ocupado en algo
    const cam = game.player.camera;
    const dx = cam.position.x - g.col.position.x;
    const dz = cam.position.z - g.col.position.z;
    if (Math.hypot(dx, dz) > 2.1) return false;
    const facing = new Vector3(Math.sin(g.yaw), 0, Math.cos(g.yaw));
    const dir = new Vector3(dx, 0, dz).normalize();
    return Vector3.Dot(facing, dir) < -0.3; // estás a su espalda
  };

  const resetCeladores = () => {
    for (const g of celadores) {
      g.idx = 0;
      g.estado = "ronda";
      g.spotObjetivo = null;
      g.col.position.set(g.ruta[0].x, 0.9, g.ruta[0].z);
      g.npc.root.position.set(g.ruta[0].x, 0, g.ruta[0].z);
      g.npc.setMoving(false);
    }
  };

  // ------------------------------------------------------------- captura
  let atrapado = false;
  const pillado = async () => {
    if (atrapado || game.ended || state.get("nivel") !== 4) return;
    atrapado = true;
    game.sfx.chaseStop();
    musica = false;
    game.sfx.caught();
    game.playing = false;
    game.player.setControl(false);
    await hud.fade(true, 650);
    if (escondido) salirEscondite(true);
    const cam = game.player.camera;
    cam.position.set(3.6, 1.62, 191);
    cam.rotation.set(0, Math.PI / 2, 0);
    resetCeladores();
    await new Promise((r) => setTimeout(r, 350));
    graciaHasta = performance.now() + 4500;
    game.playing = true;
    game.player.setControl(true);
    hud.fade(false, 800);
    game.notify("Te agarran entre dos y te sueltan en la entrada del ala. «A la próxima, correas.»", 4200);
    atrapado = false;
  };

  // ------------------------------------------------------------- IA
  let musica = false;
  let graciaHasta = 0; // tras aparecer o ser atrapado, unos segundos de respiro
  const prevCam = new Vector3();
  let prevCamInit = false;

  const mover = (g: Celador, tx: number, tz: number, v: number, dt: number): boolean => {
    const dx = tx - g.col.position.x;
    const dz = tz - g.col.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) {
      g.npc.setMoving(false);
      return true;
    }
    const paso = Math.min(d, v * dt);
    g.col.moveWithCollisions(new Vector3((dx / d) * paso, -0.02, (dz / d) * paso));
    g.col.position.y = 0.9;
    g.npc.root.position.set(g.col.position.x, 0, g.col.position.z);
    g.yaw = lerpAngle(g.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));
    g.npc.root.rotation.y = g.yaw;
    g.npc.setMoving(true);
    return false;
  };

  let iaLast = 0;
  game.onUpdate.push(() => {
    if (state.get("nivel") !== 4 || !game.playing || game.ended || atrapado) return;
    if (game.dialogue.isOpen || game.keypad.isOpen || game.inventory.isOpen || game.journal.isOpen) return;
    const cam = game.player.camera;
    const now = performance.now();
    // delta por reloj real (el del motor puede reportar 0 y congelaría la IA)
    if (!iaLast) iaLast = now;
    const dt = Math.min(0.05, (now - iaLast) / 1000);
    iaLast = now;
    if (!prevCamInit) {
      prevCam.copyFrom(cam.position);
      prevCamInit = true;
    }
    const velJugador = dt > 0 ? Math.hypot(cam.position.x - prevCam.x, cam.position.z - prevCam.z) / dt : 0;
    prevCam.copyFrom(cam.position);
    const oculto = !!escondido;
    const agachado = game.player.crouched;
    const ruidoRadio = velJugador < 0.4 || oculto ? 0 : agachado ? 2 : game.player.sprinting ? 11 : 6.5;

    let cazando = 0;
    for (const g of celadores) {
      const gp = g.col.position;
      const dx = cam.position.x - gp.x;
      const dz = cam.position.z - gp.z;
      const dist = Math.hypot(dx, dz);

      // ¿te ve? (cono + distancia + línea de vista; la linterna delata de lejos)
      let ve = false;
      if (!oculto && now > graciaHasta) {
        let rango = 11 * (agachado ? 0.85 : 1);
        if (game.player.flashOn) rango += 6;
        if (dist < rango) {
          const facing = new Vector3(Math.sin(g.yaw), 0, Math.cos(g.yaw));
          const dir = new Vector3(dx / dist, 0, dz / dist);
          if (Vector3.Dot(facing, dir) > 0.55 || dist < 1.7) {
            const origen = new Vector3(gp.x, 1.5, gp.z);
            const d3 = Vector3.Distance(origen, cam.position);
            const ray = new Ray(origen, cam.position.subtract(origen).normalize(), d3);
            const hit = scene.pickWithRay(ray, (m) => m.checkCollisions && m.isEnabled());
            ve = !(hit?.hit && hit.distance < d3 - 0.35);
          }
        }
      }
      if (ve) {
        g.lastSeen.copyFrom(cam.position);
        g.lastLOS = now;
        if (g.estado !== "caza") {
          g.estado = "caza";
          game.sfx.alert();
        }
      }

      if (g.estado === "caza") {
        cazando++;
        const objetivo = g.spotObjetivo ?? (ve ? cam.position : g.lastSeen);
        mover(g, objetivo.x, objetivo.z, 4.9, dt);
        // te atrapa
        if (!oculto && dist < 1.25) {
          void pillado();
          return;
        }
        if (g.spotObjetivo && Math.hypot(g.spotObjetivo.x - gp.x, g.spotObjetivo.z - gp.z) < 1.5) {
          // te vio esconderte: te saca del armario
          void pillado();
          return;
        }
        if (!ve && !g.spotObjetivo && now - g.lastLOS > 3500) {
          g.estado = "busca";
          g.target.copyFrom(g.lastSeen);
          g.buscaHasta = 0;
        }
      } else if (g.estado === "busca") {
        if (g.buscaHasta === 0) {
          if (mover(g, g.target.x, g.target.z, 2.7, dt)) g.buscaHasta = now + 3600;
        } else {
          g.npc.setMoving(false);
          g.yaw += Math.sin(now / 300) * 0.03;
          g.npc.root.rotation.y = g.yaw;
          if (now > g.buscaHasta) {
            // vuelve al punto de ronda más cercano
            let mejor = 0;
            let mejorD = 1e9;
            g.ruta.forEach((wp, i) => {
              const d = Math.hypot(wp.x - gp.x, wp.z - gp.z);
              if (d < mejorD) {
                mejorD = d;
                mejor = i;
              }
            });
            g.idx = mejor;
            g.estado = "ronda";
          }
        }
      } else if (g.estado === "espera") {
        g.npc.setMoving(false);
        if (now > g.esperaHasta) {
          g.idx = (g.idx + 1) % g.ruta.length;
          g.estado = "ronda";
        }
      } else {
        // ronda
        const wp = g.ruta[g.idx];
        if (mover(g, wp.x, wp.z, 1.75, dt)) {
          if (wp.w) {
            g.estado = "espera";
            g.esperaHasta = now + wp.w * 1000;
          } else {
            g.idx = (g.idx + 1) % g.ruta.length;
          }
        }
        // oído: el ruido lo atrae
        if (!ve && !oculto && now > graciaHasta && ruidoRadio > 0 && dist < ruidoRadio) {
          g.estado = "busca";
          g.target.copyFrom(cam.position);
          g.buscaHasta = 0;
        }
      }
    }

    if (cazando > 0 && !musica) {
      musica = true;
      game.sfx.chaseStart();
    } else if (cazando === 0 && musica) {
      musica = false;
      game.sfx.chaseStop();
    }
  });

  // ------------------------------------------------------------- objetivos
  const updateObjective4 = () => {
    if (state.get("nivel") !== 4) return;
    if (state.has("tarjeta_roja")) return game.setObjective("Tienes la TARJETA ROJA.\nAbre la puerta de la azotea (sureste).");
    if (state.get("tablon_visto"))
      return game.setObjective("GUZMÁN lleva la TARJETA ROJA.\nSe escapa a fumar a la sala de máquinas:\nróbale el bolsillo mientras esté distraído.");
    if (state.get("vio_azotea")) return game.setObjective("La puerta de la azotea pide una TARJETA ROJA.\nAlgún celador la lleva encima.");
    game.setObjective("Ala C.\nLlega a la azotea sin que te vean.\nEscóndete en armarios y bajo las mesas.");
  };

  // ------------------------------------------------------------- luces y transición
  const placeLights4 = () => {
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
    const cold = new Color3(0.68, 0.76, 0.92);
    set(0, 46, 185, 0.5, 12, warm); // sala celadores
    set(1, 15, 192, 0.45, 14, warm); // pasillo norte (parpadeo)
    set(2, 48, 192, 0.4, 12, cold);
    set(3, 18, 205, 0.42, 13, cold); // comedor
    set(4, 41, 205, 0.42, 13, warm); // dormitorio
    set(5, 30, 218, 0.45, 14, warm); // pasillo sur
    set(6, 28, 226, 0.42, 12, warm); // máquinas
    set(7, 48, 226, 0.5, 11, new Color3(0.55, 1, 0.6)); // azotea
  };

  game.enterLevel4 = async () => {
    if (state.get("nivel") === 4) return;
    game.playing = false;
    game.player.setControl(false);
    await hud.fade(true, 1400);
    state.set("nivel", 4);
    placeLights4();
    resetCeladores();
    const cam = game.player.camera;
    cam.position.set(3.6, 1.62, 191);
    cam.rotation.set(0, Math.PI / 2, 0);
    updateObjective4();
    hud.setLocation("ALA C");
    game.savePlayer();
    await game.interlude([
      "ALA C",
      "El ala que no sale en los planos.",
      "Aquí las rondas no se hacen por rutina.\nSe hacen por hambre.",
      "Que no te vean.",
    ]);
    graciaHasta = performance.now() + 4500;
    game.playing = true;
    game.player.setControl(true);
    await hud.fade(false, 1700);
    game.checkPause();
  };

  if (state.get("nivel") === 4) {
    placeLights4();
    updateObjective4();
    graciaHasta = performance.now() + 4500;
  }
}
