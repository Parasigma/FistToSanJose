import {
  Animation,
  Color3,
  DynamicTexture,
  EasingFunction,
  Mesh,
  MeshBuilder,
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
import { buildItemModel } from "./models";
import { createNPC, NPC } from "./npc";

const T = 2;
const WALL_H = 3;
const Z_OFF = 120;

// El Archivo: nave diáfana (las estanterías hacen los pasillos) y, al este,
// la sala anexa que hizo falta para un solo expediente.
const MAP3 = [
  "########################################",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#......................................#",
  "#......................................#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "#............................##........#",
  "########################################",
];

const cz = (r: number) => (r + 0.5) * T + Z_OFF;

export function buildLevel3(game: Game) {
  const scene = game.scene;
  const state = game.state;

  // ------------------------------------------------------------- materiales
  const matWall = texMat(scene, "wall3", grimeTexture(scene, "wallT3", { base: "#5e6058", stains: 12, zocalo: "#35362f" }));
  const matFloor = texMat(
    scene,
    "floor3",
    grimeTexture(scene, "floorT3", { base: "#4f4c45", tiles: 2, speckle: 4200, stains: 12 }),
    MAP3[0].length,
    MAP3.length
  );
  const matCeil = texMat(
    scene,
    "ceil3",
    grimeTexture(scene, "ceilT3", { base: "#2c2b27", speckle: 2600, stains: 12 }),
    MAP3[0].length,
    MAP3.length
  );
  const matShelf = texMat(scene, "shelf3", grimeTexture(scene, "shelfT3", { base: "#463929", planks: true, speckle: 1800 }));
  const matShelfBurnt = colorMat(scene, "shelfBurnt3", "#191612");
  const matBoxes = texMat(scene, "boxes3", grimeTexture(scene, "boxesT3", { base: "#8a7a58", speckle: 2200, stains: 6 }));
  const matFrame = colorMat(scene, "frame3", "#2f312b");
  const matDoor = texMat(scene, "door3", grimeTexture(scene, "doorT3", { base: "#4a5054", planks: true, stains: 6 }));
  const matWood = texMat(scene, "wood3", grimeTexture(scene, "woodT3", { base: "#54432f", planks: true, speckle: 1500 }));
  const matPaper = colorMat(scene, "paper3", "#d6d0be", 0.12);

  // ------------------------------------------------------------- geometría
  const boxes: Mesh[] = [];
  for (let r = 0; r < MAP3.length; r++) {
    for (let c = 0; c < MAP3[r].length; c++) {
      if (MAP3[r][c] !== "#") continue;
      let nearFloor = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (MAP3[r + dr]?.[c + dc] === ".") nearFloor = true;
        }
      }
      if (!nearFloor) continue;
      const b = MeshBuilder.CreateBox("w3", { width: T, height: WALL_H, depth: T }, scene);
      b.position.set((c + 0.5) * T, WALL_H / 2, cz(r));
      boxes.push(b);
    }
  }
  const walls = Mesh.MergeMeshes(boxes, true, true)!;
  walls.name = "walls3";
  walls.material = matWall;
  walls.checkCollisions = true;
  walls.freezeWorldMatrix();
  minimap.register(3, MAP3, Z_OFF);

  const W = MAP3[0].length * T;
  const H = MAP3.length * T;
  const ground = MeshBuilder.CreateGround("ground3", { width: W, height: H }, scene);
  ground.position.set(W / 2, 0, Z_OFF + H / 2);
  ground.material = matFloor;
  ground.checkCollisions = true;
  const ceil = MeshBuilder.CreateGround("ceil3", { width: W, height: H }, scene);
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
    const dt = new DynamicTexture("sg3_" + text, { width: texW, height: 64 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
    dt.drawText(text, null, 44, "bold 38px 'Courier New'", fg, bg, true);
    const m = new StandardMaterial("sgm3_" + text, scene);
    m.diffuseTexture = dt;
    m.emissiveTexture = dt;
    m.emissiveColor = new Color3(0.55, 0.55, 0.55);
    m.specularColor = Color3.Black();
    const p = MeshBuilder.CreatePlane("sgp3_" + text, { width: w, height: w * (64 / texW), sideOrientation: Mesh.DOUBLESIDE }, scene);
    p.position.set(x, y, z);
    p.rotation.y = faceRy + Math.PI;
    p.material = m;
    return p;
  };

  // estantería doble cara con baldas de cajas
  const shelfRow = (x: number, z: number, len: number, burnt = false) => {
    const body = box("est3", len, 2.3, 0.7, x, 1.15, z, burnt ? matShelfBurnt : matShelf);
    if (!burnt) {
      for (const y of [0.6, 1.25, 1.9]) {
        box("lomos3", len - 0.4, 0.36, 0.74, x, y, z, matBoxes, { collide: false });
      }
    }
    return body;
  };

  // ------------------------------------------------------------- llegada
  // puerta de la escalera por la que bajas (norte, cerrada a tu espalda)
  box("escFrameL3", 0.16, 2.6, 0.32, 5.05, 1.3, 122.1, matFrame);
  box("escFrameR3", 0.16, 2.6, 0.32, 6.95, 1.3, 122.1, matFrame);
  const escDoor = box("escDoor3", 1.7, 2.48, 0.12, 6, 1.24, 122.06, matDoor);
  sign("ESCALERA — P1", 6, 2.62, 122.14, 0, "#9fe89f", "#0d2010", 1.8);
  game.register(escDoor, "escDoor3", "Subir a la planta 1", () => {
    game.sfx.doorCreak();
    game.enterLevel2?.();
  });

  // el plano del sótano, en un atril junto a la entrada
  box("atril3", 0.5, 1.0, 0.4, 9.5, 0.5, 123.6, matWood);
  if (!state.has("mapa3")) {
    const mapa3M = box("mapa3", 0.36, 0.015, 0.28, 9.5, 1.03, 123.6, matPaper, { collide: false });
    mapa3M.rotation.y = 0.25;
    game.register(mapa3M, "mapa3", "Coger el plano del Archivo", () => {
      state.addItem({
        id: "mapa3",
        name: "Plano — Sótano · El Archivo",
        desc: "El plano de consulta del Archivo. Las secciones están numeradas con una letra diminuta y nerviosa. La S–Z está tachada.",
      });
      mapa3M.dispose();
      game.sfx.pickup();
      game.notify("Has cogido el plano del Archivo. El mapa vuelve a acompañarte.");
    });
  }

  // ------------------------------------------------------------- estanterías
  const SECC = [
    { z: 130, nombre: "SECCIÓN A–F" },
    { z: 136, nombre: "SECCIÓN G–M" },
    { z: 142, nombre: "SECCIÓN N–R" },
    { z: 148, nombre: "SECCIÓN S–Z", burnt: true },
  ];
  for (const s of SECC) {
    const w = shelfRow(16, s.z, 20, !!s.burnt);
    const e = shelfRow(44, s.z, 20, !!s.burnt);
    sign(s.nombre + (s.burnt ? " · QUEMADA" : ""), 30, 2.45, s.z, Math.PI, s.burnt ? "#8a5a4a" : "#cfc9b8", "#20221f", 2.2);
    (s as { west?: Mesh; east?: Mesh }).west = w;
    (s as { east?: Mesh }).east = e;
  }

  // expedientes consultables (la biblia del grupo, en formato diagnóstico)
  const secAF = SECC[0] as unknown as { west: Mesh; east: Mesh };
  game.register([secAF.west, secAF.east], "expAF", "Consultar la sección A–F", () => {
    game.talk(
      {
        a1: {
          speaker: "EXPEDIENTE — A–F",
          text: "«CORREDOR IBARRA, ALEJANDRO — 'el Chus'.\nDiagnóstico: fuguismo festivo crónico.\nSe ha fugado de tres manicomios, dos bodas y una mili.\nReadmitido siempre por voluntad propia: 'aquí se duerme\nde lujo'. Vigilar en fechas de festival.»",
          next: "a2",
        },
        a2: {
          text: "«FLORIDO VERDÚ, EDUARDO — 'Montreal'.\nDiagnóstico: serenidad incompatible con el entorno.\nConfunde vigilar con leer manga. Sostiene que la Grand Line\npasa por el pasillo del ala B. Cero intentos de fuga.\nPreocupante: parece feliz.»",
        },
      },
      "a1"
    );
  });

  const secGM = SECC[1] as unknown as { west: Mesh; east: Mesh };
  game.register([secGM.west, secGM.east], "expGM", "Consultar la sección G–M", () => {
    game.talk(
      {
        g1: {
          speaker: "EXPEDIENTE — G–M",
          text: "En la balda, entre GARCÍA ONANDIA, R. y LAMAS,\nhay un hueco con una ficha de cartón:\n\n«GARCÍA ONANDIA, ISMAEL — NO CABE EN LA BALDA.\nVer caja reforzada. Suelo. CANDADA.»",
          next: "g2",
        },
        g2: {
          text: "«GARCÍA ONANDIA, RUBÉN — 'Cauntu'.\nDiagnóstico: ciencia sin supervisión.\nSolicita presupuesto para un 'Niku-Borg 9000'. Denegado.\nSolicita plutonio. MUY denegado.\nOdia al Director con rigor de tesis doctoral.»",
          next: "g3",
        },
        g3: {
          text: "«LAMAS TRUJILLO, VICTOR — 'el Calvo'.\nDiagnóstico: manitas destructivo, grado máximo.\n'Arregló' el generador: nueve horas sin luz.\n'Arregló' el ascensor: ahora es un armario.\nProhibido darle herramientas. PROHIBIDO.»",
          next: "g4",
        },
        g4: {
          text: "«MONZO VEZA, JORGE — 'el Impresor'.\nDiagnóstico: emisiones silenciosas y devoción por el PLA.\nVa por el intento 14 de la misma figurita.\nSu gato Peter (9 kg) consta como visita terapéutica.\nPeligro: no sentarse nunca después de él.»",
        },
      },
      "g1"
    );
  });

  const secNR = SECC[2] as unknown as { west: Mesh; east: Mesh };
  game.register([secNR.west, secNR.east], "expNR", "Consultar la sección N–R", () => {
    game.talk(
      {
        n1: {
          speaker: "EXPEDIENTE — N–R",
          text: "«ROVIRA ARANDA, KEVIN — 'el Mofeta'.\nDiagnóstico: dieta monotemática (kebab) y guerra química.\nEl evento del 'Pedo Atómico' sigue clasificado.\nLa sala de terapia 2 aún se ventila.\nDieta prescrita: verdura. Cumplimiento: cero.»",
          next: "n2",
        },
        n2: {
          text: "Y al fondo, otra caja: «ROVIRA ARANDA, RAFAEL».\nExiste. Pero está precintada con cinta del propio sanatorio\ny un sello lacrado:\n\n«EL DIRECTOR NO SE ARCHIVA»",
          next: "n3",
        },
        n3: {
          text: "(Si el Director no se archiva...\n¿por qué su caja está EN el archivo?)",
          action: () => {
            state.set("exp_rovira");
          },
        },
      },
      "n1"
    );
  });

  const secSZ = SECC[3] as unknown as { west: Mesh; east: Mesh };
  game.register([secSZ.west, secSZ.east], "expSZ", "Tocar la sección quemada", () => {
    game.talk(
      {
        s1: {
          speaker: "SECCIÓN S–Z",
          text: "Ceniza fría. La sección S–Z ardió entera hace años.\nAquí dormían SERNA QUESADA y VANDE SIJPE, entre otros.\n\nNadie archiva con fuego por accidente.",
        },
      },
      "s1"
    );
  });

  // ------------------------------------------------------------- la mesa y C.M.
  box("mesaArch", 2.4, 0.8, 1.2, 30, 0.4, 152.5, matWood);
  box("flexo", 0.08, 0.5, 0.08, 29.2, 1.05, 152.2, matFrame, { collide: false });
  const cajaCM = box("cajaCM", 0.42, 0.3, 0.32, 30.2, 0.95, 152.5, matBoxes, { collide: false });
  const tapaCM = box("tapaCM", 0.44, 0.04, 0.34, 30.2, 1.12, 152.5, matPaper, { collide: false });
  game.register([cajaCM, tapaCM], "cajaCM", "Abrir la caja «C.M.»", () => {
    game.talk(
      {
        c1: {
          speaker: "ARCHIVO",
          text: "Una caja de expediente espera en el centro de la mesa,\nperfectamente alineada, mirando hacia la entrada.\nLa etiqueta, con tinta aún fresca: «C.M.»",
          next: "c2",
        },
        c2: {
          text: "Dentro: nada. Ni una hoja, ni una ficha.\nSolo una nota doblada por la mitad:\n\n«¿De verdad creías que iba a dejarlo POR ESCRITO?\nBaja. Te espero en el ALA C.»",
          next: "c3",
        },
        c3: {
          text: "(Esa letra.\nOtra vez esa letra.)",
          action: () => {
            state.set("cm_visto");
            updateObjective3();
            game.sfx.distant();
          },
        },
      },
      "c1"
    );
  });

  // ------------------------------------------------------------- puerta ALA C
  box("alaFrameL", 0.16, 2.6, 0.32, 29.05, 1.3, 157.9, matFrame);
  box("alaFrameR", 0.16, 2.6, 0.32, 30.95, 1.3, 157.9, matFrame);
  const alaDoor = box("alaDoor", 1.7, 2.48, 0.12, 30, 1.24, 157.94, matDoor);
  sign("ALA C", 30, 2.62, 157.86, Math.PI, "#9fe89f", "#0d2010", 1.2);
  game.register(
    alaDoor,
    "alaDoor",
    () => (state.get("cm_visto") && state.get("secretaria_fuera") ? "Bajar al ALA C" : "Puerta del ALA C"),
    () => {
      if (!state.get("cm_visto")) {
        game.sfx.locked();
        game.notify("Atrancada. O más bien... esperando algo. El Archivo aún no ha terminado contigo.");
        return;
      }
      if (!state.get("secretaria_fuera")) {
        game.sfx.locked();
        state.set("secretaria_vista");
        updateObjective3();
        game.notify("La secretaria carraspea sin levantar la vista: «Sin volante sellado, ni lo intente.»");
        return;
      }
      game.sfx.unlock();
      game.sfx.doorCreak();
      state.set("nivel2_completado");
      setTimeout(() => game.enterLevel4?.(), 900);
    }
  );

  // ------------------------------------------------------------- SALA ANEXA: EXP. MARIO MATAS
  // Un solo expediente que no cabía en ninguna balda. Ni en dos.
  box("marioJambaN", 0.5, 2.9, 0.3, 60, 1.45, 137.9, matFrame);
  box("marioJambaS", 0.5, 2.9, 0.3, 60, 1.45, 142.1, matFrame);
  box("marioDintel", 0.5, 0.45, 4.3, 60, 2.78, 140, matFrame);
  sign("EXP. MARIO MATAS", 59.85, 2.4, 140, -Math.PI / 2, "#d6b96a", "#241d10", 2.6);
  sign("SALA ANEXA — NO CABÍA", 59.85, 1.75, 140, -Math.PI / 2, "#8a8474", "#1a1a1c", 2.2);

  /** Estantería de la sala de Mario: dos caras registrables por separado. */
  const shelfMario = (z: number, idN: string, tomoN: () => DTree, idS: string, tomoS: () => DTree) => {
    box("mEst" + z, 12, 2.3, 0.7, 70, 1.15, z, matShelf);
    for (const y of [0.6, 1.25, 1.9]) {
      box("mLomos" + z + y, 11.6, 0.36, 0.74, 70, y, z, matBoxes, { collide: false });
    }
    const caraN = box("mCaraN" + z, 11.6, 2.2, 0.06, 70, 1.15, z - 0.4, matBoxes, { collide: false });
    const caraS = box("mCaraS" + z, 11.6, 2.2, 0.06, 70, 1.15, z + 0.4, matBoxes, { collide: false });
    game.register(caraN, idN, "Consultar esta cara del expediente", () => game.talk(tomoN(), "t1"));
    game.register(caraS, idS, "Consultar esta cara del expediente", () => game.talk(tomoS(), "t1"));
  };

  shelfMario(
    125,
    "mTomo1",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO I",
        text: "«ETAPA FORMATIVA. Incidente 004.\nEl sujeto orina en las escaleras centrales del instituto.\nEn hora punta. Sin buscar amparo.»",
        next: "t2",
      },
      t2: {
        text: "«Declaración del sujeto: 'no llegaba'.\nDistancia al baño: once metros.\nEl conserje aún lo cuenta en presente.»",
      },
    }),
    "mTomo2",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO II",
        text: "«Incidente 011: arroja un vaso de agua encima\nde la interna NATALITA CRESPO.\nSin motivo aparente. Sin motivo real.»",
        next: "t2",
      },
      t2: {
        text: "«Alegación: 'hacía calor'.\nMes de los hechos: noviembre.\nLa afectada no ha vuelto a fiarse de nadie con vaso.»",
      },
    })
  );

  shelfMario(
    130,
    "mTomo3",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO IV",
        text: "«FARMACOLOGÍA RECREATIVA.\nEl sujeto ingiere Viagra antes de salir de fiesta.\nNo por necesidad. Por CURIOSIDAD.»",
        next: "t2",
      },
      t2: {
        text: "«Efectos observados: euforia, taquicardia,\nplanes a las cuatro de la mañana\ny una convicción de sí mismo imposible de rebatir.\n\nRepetido. Varias veces. A conciencia.»",
      },
    }),
    "mTomo4",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO V",
        text: "«CORRESPONDENCIA.\nEl sujeto insiste en 'echar carta al buzón'.\nNo consta ningún destinatario. Ni una sola carta.»",
        next: "t2",
      },
      t2: {
        text: "«El grupo entiende la expresión.\nEl equipo médico, no.\nSe archiva como 'actividad postal de alto riesgo'.»",
      },
    })
  );

  shelfMario(
    135,
    "mTomo5",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO VII",
        text: "«ONOMÁSTICA. Sección más voluminosa del expediente.\nEl sujeto inventa nombres para los demás internos\ny los impone hasta que sustituyen al original.»",
        next: "t2",
      },
      t2: {
        text: "«Registrados: 'KUROI TE'. 'ANOVALDO'.\n'DESIDERIO'. 'VANDIMILIAN'.\nNinguno de los afectados recuerda quién los puso.»",
        next: "t3",
      },
      t3: {
        text: "«Nota del archivero:\nEl sujeto tampoco lo recuerda.\nO eso dice.»",
        action: () => state.set("mario_motes"),
      },
    }),
    "mTomo6",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO IX",
        text: "«CONDUCTA EN PARTIDA COMPARTIDA.\nEn una campaña de Left 4 Dead, el sujeto dispara\na un barril de gasolina situado junto a sus compañeros.»",
        next: "t2",
      },
      t2: {
        text: "«Bajas: la partida entera. Incluido él.\nJustificación aportada: 'quería ver si explotaba'.\nExplotó.»",
      },
    })
  );

  shelfMario(
    145,
    "mTomo7",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO XII",
        text: "«JUEGOS DE MESA. Partida de KEVIPOLY.\nEl sujeto lee en voz alta la casilla que le toca:\n\n'TU PERRO HA GANADO UN CONCURSO CANINO'.»",
        next: "t2",
      },
      t2: {
        text: "«Reacción unánime de la mesa: 'QUÉ PIEDRA'.\nEl sujeto no tenía perro.\nEl sujeto sigue sin tener perro.»",
        next: "t3",
      },
      t3: {
        text: "«La frase se cita en el ala B como unidad de medida\nde lo absurdo. Una piedra. Dos piedras.»",
      },
    }),
    "mTomo8",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO XV",
        text: "«AUTOMOCIÓN Y AFIRMACIONES TÉCNICAS.\nEl sujeto sostiene, ante testigos, que una\nPIAGGIO ZIP monta motor de CUATRO TIEMPOS.»",
        next: "t2",
      },
      t2: {
        text: "«Se le muestra documentación del fabricante.\nSe reafirma.\nSe le muestra el propio motor.\nSe reafirma más fuerte.»",
      },
    })
  );

  shelfMario(
    150,
    "mTomo9",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO XVIII",
        text: "«ASUNTOS DEL CORAZÓN (y de la moto).\nEl sujeto se lía con CRISTINA.\nLa lleva de paquete. Por el pueblo. A plena luz.»",
        next: "t2",
      },
      t2: {
        text: "«Agravante: Cristina era, en ese momento,\npareja del interno conocido como DESIDERIO.\nMote que, por cierto, le había puesto el propio sujeto.»",
        next: "t3",
      },
      t3: {
        text: "«El sujeto niega premeditación.\nEl expediente, tres tomos más adelante,\nla sugiere.»",
      },
    }),
    "mTomo10",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO XXI",
        text: "«ANEXOS PERSONALES.\nInjerto capilar: 'confianza +100, humildad -100'.\nMotero. Vicioso de PC.»",
        next: "t2",
      },
      t2: {
        text: "«Constante documentada a lo largo de 24 tomos:\nSIEMPRE SEGUNDO. Detrás de GARCÍA ONANDIA, I.\nEn el WoW. En el kart. En todo.»",
        next: "t3",
      },
      t3: {
        text: "«El sujeto afirma que no le importa.\nEl volumen de este expediente sugiere lo contrario.»",
      },
    })
  );

  shelfMario(
    155,
    "mTomo11",
    () => ({
      t1: {
        speaker: "EXP. MATAS — ADDENDA",
        text: "«Cajas sin clasificar:\n— 'Lo del kart'.\n— 'Lo del karaoke'.\n— 'Lo del perro que no era su perro'.\n— 'Lo de la gasolinera' (dos cajas).»",
        next: "t2",
      },
      t2: {
        text: "«Solicitud del archivero jefe:\nampliar la sala. Otra vez.\nRespuesta de Dirección: 'no queda edificio'.»",
      },
    }),
    "mTomo12",
    () => ({
      t1: {
        speaker: "EXP. MATAS — TOMO EN CURSO",
        text: "El último atril tiene un tomo ABIERTO.\nSin cerrar. Sin archivar.\nLa última entrada es de esta madrugada.",
        next: "t2",
      },
      t2: {
        text: "«03:47 — El sujeto abandona la habitación 104.\n04:10 — El sujeto desciende a la planta 1.\n04:38 — El sujeto entra en el Archivo.»",
        next: "t3",
      },
      t3: {
        text: "«04:52 — El sujeto lee esto.»\n\n(La tinta del último renglón aún brilla.)",
        next: "t4",
      },
      t4: {
        text: "(Y la letra —la reconoces ahora sin poder evitarlo—\nes exactamente la misma que la de la nota\nque encontraste bajo tu puerta.)",
        action: () => {
          state.set("mario_tomo_curso");
          game.sfx.distant();
        },
      },
    })
  );

  // ------------------------------------------------------------- VISITAS (acompañantes)
  const visitas = shelfRow(12, 126.6, 10);
  sign("VISITAS · ACOMPAÑANTES", 12, 2.45, 126.6, Math.PI, "#cfc9b8", "#20221f", 2.4);
  game.register(visitas, "expVisitas", "Consultar el archivo de visitas", () => {
    game.talk(
      {
        v1: {
          speaker: "ARCHIVO DE VISITAS",
          text: "«MARCOS, LAURA — visita de R. Rovira.\nExpediente marcado VIP por orden de Dirección.\nNadie sabe por qué.\n(Todos saben por qué.)»",
          next: "v2",
        },
        v2: {
          text: "«MARTÍNEZ, ELIZABETH — visita de I. García. 'La Santa'.\nAdjunta: lista de QT pendientes.\nEl sanatorio la reconoce como terapia externa.\nY como milagro.»",
          next: "v3",
        },
        v3: {
          text: "«PAOLA — visita de J. Monzo.\nSolicitudes presentadas: 14 festivales.\nConcedido: un bocata de panceta y una sombra.»",
          next: "v4",
        },
        v4: {
          text: "«LA AMIGA — visita de E. Florido.\nSin nombre en el registro. Consta en todas las visitas.\nNadie la ha visto llegar. Nadie la ha visto irse.»",
          next: "v5",
        },
        v5: {
          text: "«NORMA — visita de J.C. Rabasco.\nComparten una lista de agravios de gestión conjunta.\nEl sanatorio lo considera terapia de pareja.»",
          next: "v6",
        },
        v6: {
          text: "«CLARA — visita de P. Serna.\nSolicitó visitarlo con casco.\nEl casco fue denegado: 'transmite desconfianza'.»",
        },
      },
      "v1"
    );
  });

  // ------------------------------------------------------------- pacientes por los pasillos
  /** Quiénes han caído (tras la rabia del yogur) y qué se ve en cada uno. */
  const muertos = new Set<string>();
  const FORENSE: Record<string, string> = {
    Rabasco:
      "Boca abajo entre dos cajas.\nTiene el cuello marcado con heridas punzantes,\nordenadas, casi simétricas.\n\n(Alguien se tomó su tiempo. Alguien muy picado.)",
    Jorge:
      "Sentado contra la estantería, como si se hubiera cansado.\nManchas de yogur de piña por toda la camisa,\ny en la boca, a la fuerza.\n\n(La cuchara no aparece.)",
    Kevin:
      "Le han vaciado el bolsillo del kebab.\nHuele a döner y a piña, y eso no debería poder oler.\nTiene una ficha de cartón clavada en el pecho: «G–M».",
    Paquito:
      "Ha hecho falta tumbar tres estanterías para tumbarlo a él.\nSigue teniendo los puños cerrados.\nEn la frente, una huella de pie descalzo.",
    Secretaria:
      "Sigue en su sitio, con el sello en la mano.\nTiene un envase de yogur encajado en la boca\ny un volante sellado en la frente: «AUTORIZADO».\n\n(Al final le dieron su papeleo.)",
  };

  const mkPaciente = (
    nombre: string,
    etiqueta: string,
    x: number,
    z: number,
    opts: { shirt: string; pants: string; skin: string; hair?: string; scale?: number; barefoot?: boolean; glasses?: boolean },
    tree: () => DTree
  ): NPC => {
    const npc = createNPC(scene, {
      name: "arch_" + nombre,
      position: new Vector3(x, 0, z),
      yaw: 0,
      manualYaw: true,
      ...opts,
    });
    // tras la rabia ya no hablan: solo queda mirarles y describir el destrozo
    game.register(
      npc.hit,
      "arch_" + nombre,
      () => (muertos.has(nombre) ? "Examinar el cuerpo de " + etiqueta : "Hablar con " + etiqueta),
      () => {
        const forense = FORENSE[nombre];
        if (muertos.has(nombre) && forense) {
          game.talk({ f1: { speaker: etiqueta.toUpperCase(), text: forense } }, "f1");
          return;
        }
        game.talk(tree(), "s1");
      }
    );
    minimap.trackNpc(3, () => ({ x: npc.root.position.x, z: npc.root.position.z }));
    return npc;
  };

  const rabasco = mkPaciente("Rabasco", "Rabasco", 24, 128.6, { shirt: "#6a5a62", pants: "#4a444a", skin: "#c0997a" }, () => ({
    s1: {
      speaker: "JOSÉ CARLOS «EL PICADO»",
      text: "Me han archivado en la A.\n¿De qué? ¿De AGRAVIADO?\nMi apellido es RABASCO. Con R. De RENCOR.",
      options: [
        { label: "¿Qué buscas exactamente?", next: "s2" },
        { label: "¿Quién te ha picado esta vez?", next: "s3" },
        { label: "¿Y esa sala de ahí al fondo?", next: "s4" },
        { label: "Suerte con la caja." },
      ],
    },
    s2: {
      text: "Mi hoja de agravios. La oficial.\nLlevo años pidiendo copia y siempre 'se traspapela'.\nCasualidad, dicen. CASUALIDAD.",
      next: "s1b",
    },
    s3: {
      text: "Norma lleva la lista conmigo. A dos manos.\nLa suya es más larga, pero la mía tiene MEJOR letra.\nEso también me lo apunto.",
      next: "s1b",
    },
    s4: {
      text: "Ni entres. Es la sala de UNO SOLO.\nUn interno con sala propia y yo sin poder leer mi ficha.\n...Anotado. Subrayado. Doble.",
      next: "s1b",
    },
    s1b: {
      text: "¿Algo más? Que estoy ocupado.\nPicándome.",
      options: [
        { label: "¿Qué buscas exactamente?", next: "s2" },
        { label: "¿Quién te ha picado esta vez?", next: "s3" },
        { label: "Te dejo con lo tuyo." },
      ],
    },
  }));

  const jorge = mkPaciente("Jorge", "Jorge", 38, 134.6, { shirt: "#5a6a5a", pants: "#4a4a42", skin: "#bd9678", hair: "#2a2118" }, () => ({
    s1: {
      speaker: "JORGE «EL IMPRESOR»",
      text: "Mi caja pone 'emisiones silenciosas'.\nDIFAMACIÓN.\n...Vale, es verdad. Pero verlo POR ESCRITO duele.",
      options: [
        { label: "¿Y Peter?", next: "s2" },
        { label: "¿No puedes imprimirte una copia?", next: "s3" },
        { label: "¿Paola sabe que estás aquí?", next: "s4" },
        { label: "Ánimo con eso." },
      ],
    },
    s2: {
      text: "Nueve kilos de gato y ni una ficha.\nSe sienta en el teclado en plena ranked\ny para el sanatorio ES QUE NO EXISTE.\nEl mundo al revés.",
      next: "s1b",
    },
    s3: {
      text: "Me quitaron la impresora al ingresar.\n'Material no terapéutico'.\nLlevaba el intento 14 de la misma figurita.\nCATORCE. Iba a salir bien. Esta vez iba a salir bien.",
      next: "s1b",
    },
    s4: {
      text: "Le dije que me iba a un festival.\nTécnicamente no mentí: aquí hay ruido raro toda la noche\ny la comida es igual de cara.",
      next: "s1b",
    },
    s1b: {
      text: "¿Algo más? Te aviso: si me siento, hay que esperar.",
      options: [
        { label: "¿Y Peter?", next: "s2" },
        { label: "¿No puedes imprimirte una copia?", next: "s3" },
        { label: "Nada más." },
      ],
    },
  }));

  const kevin = mkPaciente("Kevin", "Kevin", 36, 140.6, { shirt: "#7a5a3a", pants: "#4f4a42", skin: "#c29a78", scale: 1.04 }, () => ({
    s1: {
      speaker: "KEVIN «EL MOFETA»",
      text: "¿Tú sabes abrir cajas? La mía tiene DOS candados.\nSolo quiero arrancar una página. Una.\nLa del... evento.",
      options: [
        { label: "¿Qué evento?", next: "s2" },
        { label: "¿Cómo se come aquí abajo?", next: "s3" },
        { label: "¿Tu hermano baja alguna vez?", next: "s4" },
        { label: "Prefiero no saberlo." },
      ],
    },
    s2: {
      text: "Tres kebabs. Y un dürüm.\nEl dürüm era de tamaño familiar, eso consta.\nLo que NO consta es que la ventana estaba cerrada.\nEso es contexto. Y el contexto lo cambia todo.",
      next: "s1b",
    },
    s3: {
      text: "Fatal. Verdura, fruta, ensalada.\nLos tres jinetes.\nLlevo 217 días soñando con döner.\nYa ni sueño: repito el menú de memoria.",
      next: "s1b",
    },
    s4: {
      text: "¿Mi hermano? Ja.\nEl 'Director' no baja al Archivo.\nDicen. Yo lo que sé es que a mí me ingresó ÉL\ny que su caja está ahí arriba, precintada.",
      action: () => state.set("kevin_director"),
      next: "s1b",
    },
    s1b: {
      text: "¿Algo más? Que tengo hambre y eso me pone tierno.",
      options: [
        { label: "¿Qué evento?", next: "s2" },
        { label: "¿Tu hermano baja alguna vez?", next: "s4" },
        { label: "Te dejo." },
      ],
    },
  }));

  const paquito = mkPaciente("Paquito", "Paquito", 36, 146.6, { shirt: "#4a4a52", pants: "#3a3a40", skin: "#b58e6e", scale: 1.16 }, () => ({
    s1: {
      speaker: "PAQUITO «LA BESTIA»",
      text: "Mi caja estaba aquí. Ahora es ceniza.\nDicen que ardió sola.",
      options: [
        { label: "¿Quién crees que la quemó?", next: "s2" },
        { label: "¿Qué es eso de Mudanzas Serna?", next: "s3" },
        { label: "¿Clara ha podido visitarte?", next: "s4" },
        { label: "Nos vemos, Paquito." },
      ],
    },
    s2: {
      text: "Yo no quemo cosas.\nYo solo las lanzo.\n(Te sostiene la mirada con una calma geológica.)\nPero alguien no quería que se leyera. Eso está claro.",
      next: "s1b",
    },
    s3: {
      text: "Mi empresa. 'Nosotros no necesitamos grúa'.\nUn quinto piso. Una lavadora. A pulso.\nEl seguro no lo cubría porque no había grúa\nque asegurar. Ahí perdimos el negocio.",
      next: "s1b",
    },
    s4: {
      text: "Pidió venir con casco.\nSe lo denegaron: 'transmite desconfianza'.\nY yo entiendo a Clara. Yo también me pondría casco.",
      next: "s1b",
    },
    s1b: {
      text: "¿Algo más?\n(Dobla, distraído, el pasamanos de una estantería.)",
      options: [
        { label: "¿Quién crees que la quemó?", next: "s2" },
        { label: "¿Qué es eso de Mudanzas Serna?", next: "s3" },
        { label: "Nada más." },
      ],
    },
  }));

  // ------------------------------------------------------------- la secretaria del ALA C
  sign("ADMISIÓN AL ALA C", 30, 2.35, 155.4, Math.PI, "#d8e8f0", "#1d2a30", 1.9);

  // nota de C.M. en el suelo, en mitad del Archivo
  const notaCM = box("notaCMsuelo", 0.3, 0.012, 0.38, 30, 0.02, 140, matPaper, { collide: false });
  notaCM.rotation.y = 0.28;
  game.register(notaCM, "notaCMsuelo", "Recoger una nota del suelo", () => {
    state.set("nota_pajarito");
    game.talk(
      {
        p1: {
          speaker: "NOTA EN EL SUELO",
          text: "«Continúa, pajarito.\nAún debes descubrir la verdad\nque se esconde entre estas paredes.»\n\nFirmado: C.M.",
          next: "p2",
        },
        p2: {
          text: "(Estaba justo en mitad del pasillo.\nBoca arriba. Sin una arruga.\nComo si alguien la hubiera dejado hace un minuto\nsabiendo exactamente por dónde ibas a pasar.)",
        },
      },
      "p1"
    );
  });
  const secretaria = createNPC(scene, {
    name: "arch_Secretaria",
    position: new Vector3(30, 0, 156.7),
    yaw: Math.PI,
    manualYaw: true,
    shirt: "#5a4a5e",
    pants: "#3a3440",
    skin: "#c9a488",
    hair: "#3a2c22",
    scale: 0.96,
  });
  minimap.trackNpc(3, () => ({ x: secretaria.root.position.x, z: secretaria.root.position.z }));
  game.register(secretaria.hit, "arch_Secretaria", "Hablar con la secretaria", () =>
    game.talk(
      state.get("secretaria_fuera")
        ? { s1: { speaker: "LA SECRETARIA", text: "(No va a levantarse en un buen rato.)" } }
        : {
            s1: {
              speaker: "LA SECRETARIA",
              text: "¿Volante de derivación? ¿Cita sellada?\n¿Autorización del Director por triplicado?\n(No levanta la vista. Sella un papel en blanco.)\nEntonces no.",
              options: [
                { label: "El Director me espera abajo.", next: "s2" },
                { label: "Solo quiero pasar.", next: "s3" },
              ],
            },
            s2: {
              text: "El Director no espera.\nEl Director ARCHIVA.\nSiguiente.",
              action: () => {
                state.set("secretaria_vista");
                updateObjective3();
              },
            },
            s3: {
              text: "Y yo solo quiero jubilarme.\nAquí nadie consigue lo que quiere.\nSiguiente.",
              action: () => {
                state.set("secretaria_vista");
                updateObjective3();
              },
            },
          },
      "s1"
    )
  );

  // ------------------------------------------------------------- el expediente candado de Nikuman
  const caja = box("cajaNiku", 1.1, 0.85, 0.75, 48, 0.43, 134.8, matBoxes);
  const tapaCaja = box("tapaNiku", 1.14, 0.08, 0.79, 48, 0.9, 134.8, matShelf, { collide: false });
  sign("GARCÍA ONANDIA, I.", 48, 1.15, 134.38, Math.PI, "#d6b96a", "#241d10", 1.5);
  const matCandado = colorMat(scene, "candadoM3", "#6e7376", 0.08);
  let candado: Mesh | null = null;
  let grillete: Mesh | null = null;
  if (!state.get("exp_niku_abierto")) {
    candado = box("candadoNiku", 0.16, 0.2, 0.07, 48, 0.62, 134.38, matCandado, { collide: false });
    grillete = box("grilleteNiku", 0.1, 0.1, 0.045, 48, 0.76, 134.38, matFrame, { collide: false });
  } else {
    tapaCaja.rotation.x = -0.9;
    tapaCaja.position.y = 1.1;
  }

  let yogurModel: TransformNode | null = null;
  const cogerYogur = () => {
    if (state.has("yogur_caducado") || state.get("yogur_dado")) return;
    state.addItem({
      id: "yogur_caducado",
      name: "Yogur de piña (caducado)",
      desc: "La «prueba» del expediente de Ismael. Caducó hace tres años. La tapa está hinchada de ambición.",
    });
    yogurModel?.dispose();
    yogurModel = null;
    game.unregister("yogurCad");
    game.sfx.pickup();
    game.notify("Has cogido la prueba: un yogur de piña de otra época.");
    updateObjective3();
  };

  const spawnYogur = () => {
    if (state.has("yogur_caducado") || state.get("yogur_dado")) return;
    yogurModel = buildItemModel(scene, "yogur_caducado")!;
    // asomando por encima del borde de la caja, para que se vea y se pueda apuntar
    yogurModel.position.set(48, 1.02, 134.55);
    game.register(yogurModel.getChildMeshes() as Mesh[], "yogurCad", "Coger el yogur de piña (caducado)", cogerYogur);
  };
  if (state.get("exp_niku_abierto")) spawnYogur();

  // --- minijuego de ganzúa: hurgar en círculos hasta el CLICK bueno
  const angDist = (a: number, b: number) => {
    let d = Math.abs(a - b) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
  };
  let lockMode = 0; // 0 off · 1 acercando · 2 hurgando · 3 saliendo
  let lockStart = 0;
  let lockAngle = 0;
  let lockSweet = 1;
  let lockReady = 0;
  let abriendo = false; // animación de apertura en curso
  let lockAcc = 0;
  const lockSaved = { pos: new Vector3(), rx: 0, ry: 0 };
  const lockFrom = new Vector3();
  let lockFromRx = 0;
  let lockFromRy = 0;
  const lockView = new Vector3(48, 0.78, 133.2);
  const destTip = MeshBuilder.CreateCylinder("destTip3", { diameter: 0.02, height: 0.3, tessellation: 8 }, scene);
  destTip.rotation.x = Math.PI / 2;
  destTip.material = colorMat(scene, "destTipM", "#9aa0a4", 0.4);
  destTip.setEnabled(false);
  destTip.isPickable = false;

  const enterLock = () => {
    if (lockMode !== 0 || game.uiBlocked()) return;
    lockMode = 1;
    game.modal = true;
    game.player.setControl(false);
    game.player.lockY = false;
    game.player.setFlashlightHidden(true);
    document.exitPointerLock?.();
    const cam = game.player.camera;
    lockSaved.pos.copyFrom(cam.position);
    lockSaved.rx = cam.rotation.x;
    lockSaved.ry = cam.rotation.y;
    lockFrom.copyFrom(cam.position);
    lockFromRx = cam.rotation.x;
    lockFromRy = cam.rotation.y;
    lockStart = performance.now();
    lockSweet = Math.random() * Math.PI * 2;
    lockVx = 60;
    lockVy = 0;
    lockAngle = 0;
    destTip.setEnabled(true);
    document.getElementById("lock-ui")!.classList.remove("hidden");
    const msg = document.getElementById("lock-msg");
    if (msg) {
      msg.textContent = "";
      msg.className = "";
    }
    hud.hide();
    game.sfx.switchClick();
  };
  const exitLock = () => {
    if (lockMode !== 2 || abriendo) return; // no cortar la animación de apertura
    lockMode = 3;
    lockFrom.copyFrom(game.player.camera.position);
    lockFromRx = game.player.camera.rotation.x;
    lockFromRy = game.player.camera.rotation.y;
    lockStart = performance.now();
    destTip.setEnabled(false);
    game.tryLock();
  };

  // El ángulo se lleva con un punto virtual, así funciona TANTO con el ratón
  // libre como con el puntero capturado (donde clientX/clientY no se mueven).
  let lockVx = 60;
  let lockVy = 0;
  window.addEventListener("mousemove", (e) => {
    if (lockMode !== 2) return;
    if (document.pointerLockElement) {
      lockVx += e.movementX || 0;
      lockVy += e.movementY || 0;
    } else {
      lockVx = e.clientX - window.innerWidth / 2;
      lockVy = e.clientY - window.innerHeight / 2;
    }
    const r = Math.hypot(lockVx, lockVy);
    if (r > 260) {
      lockVx = (lockVx / r) * 260;
      lockVy = (lockVy / r) * 260;
    } else if (r < 12) {
      lockVx = 12;
      lockVy = 0;
    }
    lockAngle = Math.atan2(lockVy, lockVx);
  });
  // sonda de diagnóstico del candado (útil si vuelve a fallar en producción)
  (window as unknown as { __lock: () => unknown }).__lock = () => ({
    lockMode,
    lockAngle,
    lockSweet,
    dist: angDist(lockAngle, lockSweet),
    tolerancia: 0.2,
    pointerLocked: !!document.pointerLockElement,
    vx: lockVx,
    vy: lockVy,
  });

  const TOL = 0.38; // ~22°: exige buscar, pero no adivinar al grado
  /** El HUD está oculto durante el minijuego: el aviso va en su propio panel. */
  const lockMsg = (texto: string, clase = "") => {
    const el = document.getElementById("lock-msg");
    if (!el) return;
    el.textContent = texto;
    el.className = clase;
  };

  const intentarAbrir = () => {
    if (lockMode !== 2 || abriendo) return;
    const d = angDist(lockAngle, lockSweet);
    if (d >= TOL) {
      game.sfx.locked();
      lockMsg(d < 0.75 ? "CASI — el pestillo se ha movido" : "AHÍ NO HAY NADA QUE EMPUJAR", "fail");
      return;
    }
    // acierto: se abre a la vista, con su animación y su ruido
    abriendo = true;
    game.sfx.lockClack();
    lockMsg("¡CLACK! EL CANDADO CEDE", "ok");
    if (grillete) {
      Animation.CreateAndStartAnimation("grilleteAbre", grillete, "rotation.z", 60, 22, 0, -1.5, Animation.ANIMATIONLOOPMODE_CONSTANT);
    }
    setTimeout(() => {
      // el candado se descuelga y cae al suelo
      game.sfx.unlock();
      if (candado) {
        Animation.CreateAndStartAnimation("candadoCae", candado, "position.y", 60, 26, candado.position.y, 0.06, Animation.ANIMATIONLOOPMODE_CONSTANT);
        Animation.CreateAndStartAnimation("candadoGira", candado, "rotation.x", 60, 26, 0, 1.4, Animation.ANIMATIONLOOPMODE_CONSTANT);
      }
      setTimeout(() => game.sfx.thud(), 380);
    }, 380);
    setTimeout(() => {
      // y la tapa se abre sola, dejando ver lo que hay dentro
      game.sfx.doorCreak();
      const ease2 = new SineEase();
      ease2.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
      Animation.CreateAndStartAnimation("tapaAbre", tapaCaja, "rotation.x", 60, 40, 0, -0.9, Animation.ANIMATIONLOOPMODE_CONSTANT, ease2);
      Animation.CreateAndStartAnimation("tapaSube", tapaCaja, "position.y", 60, 40, tapaCaja.position.y, 1.1, Animation.ANIMATIONLOOPMODE_CONSTANT, ease2);
      state.set("exp_niku_abierto");
      grillete?.dispose();
      spawnYogur();
      updateObjective3();
      lockMsg("EXPEDIENTE ABIERTO", "ok");
    }, 1150);
    setTimeout(() => {
      abriendo = false;
      exitLock();
      game.notify("El candado se rinde con un CLACK de vergüenza. Ya puedes abrir el expediente.", 4200);
    }, 2100);
  };
  window.addEventListener("mousedown", (e) => {
    if (lockMode !== 2) return;
    if (e.button === 2) exitLock(); // clic derecho: dejarlo
    else intentarAbrir();
  });
  document.addEventListener("keydown", (e) => {
    if (lockMode !== 2 || e.repeat) return;
    // margen de gracia: el autorrepetido de la [E] con la que entras ya no
    // puede cerrar el minijuego nada más abrirse
    if (performance.now() - lockReady < 450) return;
    if (e.code === "Enter" || e.code === "Space") intentarAbrir();
    else if (e.code === "Escape" || e.code === "KeyE") exitLock();
  });

  game.onUpdate.push((dt) => {
    if (state.get("nivel") !== 3) return;
    const cam = game.player.camera;
    if (lockMode === 1 || lockMode === 3) {
      const p = Math.min(1, (performance.now() - lockStart) / 700);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const dest = lockMode === 1 ? lockView : lockSaved.pos;
      const drx = lockMode === 1 ? 0.14 : lockSaved.rx;
      const dry = lockMode === 1 ? 0 : lockSaved.ry;
      cam.position = Vector3.Lerp(lockFrom, dest, e);
      cam.rotation.x = lockFromRx + (drx - lockFromRx) * e;
      cam.rotation.y = lockFromRy + Math.atan2(Math.sin(dry - lockFromRy), Math.cos(dry - lockFromRy)) * e;
      if (p >= 1) {
        if (lockMode === 1) {
          lockMode = 2;
          lockReady = performance.now();
        } else {
          lockMode = 0;
          document.getElementById("lock-ui")!.classList.add("hidden");
          game.modal = false;
          game.player.lockY = true;
          game.player.setFlashlightHidden(!state.has("linterna"));
          game.player.setControl(true);
          hud.show();
          game.checkPause();
        }
      }
    }
    if (lockMode === 2) {
      // punta del destornillador girando alrededor del ojo del candado
      const cerca = angDist(lockAngle, lockSweet);
      const jit = cerca < 0.25 ? (Math.random() - 0.5) * 0.006 : 0;
      destTip.position.set(48 + Math.cos(lockAngle) * 0.045 + jit, 0.62 + Math.sin(lockAngle) * 0.045 + jit, 134.25);
      // curva estrecha: solo "quema" de verdad al lado del punto bueno
      const prox = Math.max(0, 1 - cerca / 1.1);
      lockAcc += dt * (2 + prox * prox * 22);
      if (lockAcc > 1) {
        lockAcc = 0;
        game.sfx.lockTick(prox);
      }
      // guía en pantalla: aguja + "calor" (si no, el puzle es adivinar a ciegas)
      const dentro = cerca < TOL;
      const needle = document.getElementById("lock-needle");
      if (needle) {
        needle.style.transform = `translate(-50%, -100%) rotate(${(lockAngle * 180) / Math.PI + 90}deg)`;
        needle.style.background = dentro
          ? "linear-gradient(to top, rgba(159,232,159,0.2), #9fe89f)"
          : "linear-gradient(to top, rgba(255,217,138,0.15), #ffd98a)";
      }
      const fill = document.getElementById("lock-heat-fill");
      if (fill) {
        const calor = Math.max(0, 1 - cerca / 1.1);
        fill.style.width = (calor * 100).toFixed(1) + "%";
        fill.style.background = dentro ? "#9fe89f" : cerca < 0.7 ? "#ffd98a" : "#8a5a4a";
      }
      const panel = document.getElementById("lock-panel");
      if (panel) panel.classList.toggle("hot", dentro);
    }
  });

  game.register(
    [caja, tapaCaja].concat(candado ? [candado] : []).concat(grillete ? [grillete] : []),
    "cajaNiku",
    () =>
      state.get("exp_niku_abierto")
        ? "Leer el expediente de Ismael"
        : "Expediente GARCÍA ONANDIA, I. — candado",
    () => {
      if (state.get("exp_niku_abierto")) {
        // ya abierta: aquí (y solo aquí) se puede leer su expediente
        game.talk(
          {
            i1: {
              speaker: "EXPEDIENTE — GARCÍA ONANDIA, I.",
              text: "«'Nikuman'. Tres tomos.\nDiagnóstico: abstinencia de vicio en fase terminal.\nReclama un PC 'por motivos médicos'.\nLlama 'Mano Negra' al Director.»",
              next: "i2",
            },
            i2: {
              text: "«Kryptonita documentada: YOGUR DE PIÑA.\nNo mencionar. NO MENCIONAR.\nAdjunta: PRUEBA MATERIAL Nº 1, confiscada.\nConservar refrigerada.»",
              next: "i3",
            },
            i3: {
              text: () =>
                state.has("yogur_caducado") || state.get("yogur_dado")
                  ? "(Nadie la refrigeró. El hueco de la prueba está vacío:\nla llevas tú.)"
                  : "(Nadie la refrigeró.\nY ahí sigue, esperando en su hueco.)",
              options: [
                {
                  label: "Coger la prueba material.",
                  condition: () => !state.has("yogur_caducado") && !state.get("yogur_dado"),
                  action: () => cogerYogur(),
                },
                { label: "Cerrar el expediente." },
              ],
            },
          },
          "i1"
        );
        return;
      }
      state.set("candado_visto");
      updateObjective3();
      if (!state.has("destornillador")) {
        game.talk(
          {
            c1: {
              speaker: "CANDADO",
              text: "Un candado gordo, veterano, con la cerradura rayada\nde mil intentos anteriores.\nNecesitarías algo fino, con punta, que aguante palanca.",
              next: "c2",
            },
            c2: { text: "(Aquí abajo no hay nada así.\nQuizá toque volver sobre tus pasos.)" },
          },
          "c1"
        );
        return;
      }
      enterLock();
    }
  );

  // ------------------------------------------------------------- Nikuman y la rabia
  let rabiaFase = 0; // 0 nada · 1 en curso · 2 terminada
  let rabiaVictima = 0;
  let rabiaLast = 0;
  const nikuArch = createNPC(scene, {
    name: "arch_Nikuman",
    position: new Vector3(22, 0, 134.6),
    yaw: 0,
    manualYaw: true,
    shirt: "#7d8a7b",
    pants: "#6d6a5f",
    skin: "#c29a78",
    hair: "#4a3a2a",
    scale: 0.97,
    barefoot: true,
    glasses: true,
  });
  minimap.trackNpc(3, () => ({ x: nikuArch.root.position.x, z: nikuArch.root.position.z }));
  const victimasRabia: NPC[] = [rabasco, jorge, kevin, paquito, secretaria];
  const NOMBRE_VICTIMA = ["Rabasco", "Jorge", "Kevin", "Paquito", "Secretaria"];

  const caer = (v: NPC, silencioso = false) => {
    v.root.rotation.z = Math.PI / 2;
    v.root.position.y = 0.38;
    v.hit.checkCollisions = false;
    v.setMoving(false);
    const i = victimasRabia.indexOf(v);
    if (i >= 0) muertos.add(NOMBRE_VICTIMA[i]); // deja de hablar, pasa a examinarse
    if (!silencioso) game.sfx.thud();
  };

  const empezarRabia = () => {
    if (rabiaFase !== 0) return;
    rabiaFase = 1;
    rabiaVictima = 0;
    rabiaLast = 0;
    game.sfx.chaseStart();
    game.notify("Nikuman se ha encanado. DEL TODO.", 3200);
  };

  // delta por reloj real: si el motor reporta 0 (pestaña en segundo plano,
  // tirones), la secuencia seguiría congelada y bloquearía la partida
  game.onUpdate.push(() => {
    if (state.get("nivel") !== 3 || rabiaFase !== 1 || game.ended) return;
    const ahora = performance.now();
    if (!rabiaLast) rabiaLast = ahora;
    const dt = Math.min(0.05, (ahora - rabiaLast) / 1000);
    rabiaLast = ahora;
    const nr = nikuArch.root;
    const haciaFin = rabiaVictima >= victimasRabia.length;
    const ox = haciaFin ? 22 : victimasRabia[rabiaVictima].root.position.x;
    const oz = haciaFin ? 151.5 : victimasRabia[rabiaVictima].root.position.z;
    const dx = ox - nr.position.x;
    const dz = oz - nr.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.9) {
      if (haciaFin) {
        rabiaFase = 2;
        nikuArch.setMoving(false);
        game.sfx.chaseStop();
        state.set("secretaria_fuera");
        updateObjective3();
        game.notify("Silencio. Un silencio con regusto a piña. La puerta del ALA C ha quedado despejada.", 5200);
      } else {
        caer(victimasRabia[rabiaVictima]);
        rabiaVictima++;
      }
    } else {
      const paso = Math.min(d, 6.4 * dt);
      nr.position.x += (dx / d) * paso;
      nr.position.z += (dz / d) * paso;
      nr.rotation.y = Math.atan2(dx, dz);
      nikuArch.setMoving(true);
    }
  });

  const nikuArchTree = (): DTree => {
    if (state.get("secretaria_fuera"))
      return {
        s1: { speaker: "NIKUMAN", text: "…Piña.\n(No dice nada más. Sonríe con los ojos.\nMejor no preguntar.)" },
      };
    if (state.has("yogur_caducado"))
      return {
        s1: {
          speaker: "NIKUMAN",
          text: "Eso que llevas.\nLo huelo desde aquí.\nEs MÍO. Es la PRUEBA. Dámelo.",
          options: [
            { label: "Darle el yogur de piña caducado.", next: "s2" },
            { label: "Todavía no." },
          ],
        },
        s2: {
          text: "(Lo abre con las dos manos, con respeto.\nLo huele.\nSe hace un silencio espeso, de capilla.)",
          next: "s3",
          action: () => {
            state.removeItem("yogur_caducado");
            state.set("yogur_dado");
          },
        },
        s3: { text: "—Caducado.\n—Tres años.\n—Me lo confiscaron NUEVO.", next: "s4" },
        s4: {
          text: "(Algo hace clic detrás de sus gafas.\nNo es un clic bueno.)",
          action: () => empezarRabia(),
        },
      };
    if (state.get("exp_niku_abierto"))
      return {
        s1: { speaker: "NIKUMAN", text: "¿Ya está abierta? ¿Y DÓNDE ESTÁ?\nLa prueba. El yogur. MI yogur.\nCógelo. Tráemelo. AHORA." },
      };
    if (state.get("niku_arch"))
      return {
        s1: { speaker: "NIKUMAN", text: "Sección G–M. La caja grande del suelo.\nCANDADA.\nÁbrela. Lo que hay dentro me pertenece." },
      };
    return {
      s1: {
        speaker: "NIKUMAN",
        text: "¿También bajas a leer lo que dicen de ti?\nNo te molestes: están todas CANDADAS.\nSobre todo la mía. La mía tiene candado del gordo.",
        options: [
          { label: "¿Qué hay en tu expediente?", next: "s2" },
          { label: "Suerte con eso." },
        ],
      },
      s2: {
        text: "Mis cosas. Mi historial.\nY una PRUEBA confiscada que llevo años reclamando.\nÁbremela y te debo una. Otra.",
        action: () => {
          state.set("niku_arch");
          updateObjective3();
        },
      },
    };
  };
  game.register(nikuArch.hit, "arch_Nikuman", "Hablar con Nikuman", () => game.talk(nikuArchTree(), "s1"));

  // si la rabia ya pasó (partida cargada): cuerpos en el suelo y Nikuman en su rincón
  if (state.get("secretaria_fuera")) {
    rabiaFase = 2;
    for (const v of victimasRabia) caer(v, true);
    nikuArch.root.position.set(22, 0, 151.5);
  }

  // ------------------------------------------------------------- objetivos
  const updateObjective3 = () => {
    if (state.get("nivel") !== 3) return;
    if (state.get("secretaria_fuera"))
      return game.setObjective("La puerta del ALA C está despejada.\nBaja antes de que alguien se levante.");
    if (state.has("yogur_caducado"))
      return game.setObjective("Llévale a Nikuman su «prueba».\nQue sea lo que el Director quiera.");
    if (state.get("exp_niku_abierto"))
      return game.setObjective("Coge la prueba del expediente de Nikuman.");
    if (state.get("candado_visto") && !state.has("destornillador"))
      return game.setObjective("El expediente de Nikuman tiene candado.\nNecesitas algo fino y con punta.\nQuizá toque volver sobre tus pasos.");
    if (state.get("niku_arch") || state.get("candado_visto"))
      return game.setObjective("Abre el expediente de Nikuman\n(sección G–M, la caja grande del suelo).");
    if (state.get("secretaria_vista") && state.get("cm_visto"))
      return game.setObjective("La secretaria no te deja pasar al ALA C.\nAlgo tendrá que... distraerla.");
    if (state.get("cm_visto")) return game.setObjective("Baja al ALA C.");
    game.setObjective("El Archivo.\nEncuentra el expediente de C.M.");
  };

  // ------------------------------------------------------------- luces y transición
  const placeLights3 = () => {
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
    const cold = new Color3(0.7, 0.78, 0.95);
    set(0, 30, 124, 0.5, 13, warm); // entrada
    set(1, 16, 133, 0.4, 12, warm); // pasillo oeste (hereda el parpadeo)
    set(2, 44, 133, 0.4, 12, cold);
    set(3, 30, 139, 0.5, 14, warm); // pasillo central
    set(4, 70, 130, 0.42, 15, cold); // sala anexa de Mario (norte)
    set(5, 70, 150, 0.42, 15, cold); // sala anexa de Mario (sur)
    set(6, 30, 152, 0.55, 12, warm); // la mesa de consulta
    set(7, 30, 157, 0.5, 10, new Color3(0.55, 1, 0.6)); // ALA C
  };

  game.enterLevel3 = async () => {
    if (state.get("nivel") === 3) return;
    game.playing = false;
    game.player.setControl(false);
    await hud.fade(true, 1400);
    state.set("nivel", 3);
    placeLights3();
    const cam = game.player.camera;
    cam.position.set(6, 1.62, 123.5);
    cam.rotation.set(0, Math.PI / 2 - 0.6, 0);
    updateObjective3();
    hud.setLocation("SÓTANO · EL ARCHIVO");
    game.savePlayer();
    if (!state.get("visto_arch")) {
      state.set("visto_arch");
      await game.interlude([
        "SÓTANO",
        "EL ARCHIVO",
        "Un expediente por cada persona\nque alguna vez durmió en San José.",
        "Huele a papel viejo\ny a cosas que no se apuntan.",
      ]);
    } else {
      await new Promise((r) => setTimeout(r, 250));
    }
    game.playing = true;
    game.player.setControl(true);
    await hud.fade(false, 1700);
    game.checkPause();
  };

  if (state.get("nivel") === 3) {
    placeLights3();
    updateObjective3();
  }
}
