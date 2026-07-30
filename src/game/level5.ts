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
  Vector3,
  Vector4,
} from "@babylonjs/core";
import { colorMat, grimeTexture, texMat } from "../core/textures";
import { hud } from "../ui/hud";
import { minimap } from "../ui/minimap";
import { Game } from "./Game";

const T = 2;
const Z_OFF = 250;

// Azotea del ala C. Solo para el minimapa y la orientación: la geometría se
// construye a mano porque aquí hay muros altos, pretiles bajos y maquinaria.
const MAP5 = [
  "##############################",
  "#............................#",
  "#...####.........####........#",
  "#...####.........####........#",
  "#............................#",
  "#.........#######............#",
  "#.........#######............#",
  "#.........#######............#",
  "#............................#",
  "#.....####...........###.....#",
  "#.....####...........###.....#",
  "#............................#",
  "#...###..........#####.......#",
  "#...###..........#####.......#",
  "#............................#",
  "#.........####...............#",
  "#.........####...............#",
  "#......................###...#",
  "#......................###...#",
  "##############################",
];

const cz = (r: number) => (r + 0.5) * T + Z_OFF;

export function buildLevel5(game: Game) {
  const scene = game.scene;
  const state = game.state;

  // ------------------------------------------------------------- materiales
  const matSuelo = texMat(
    scene,
    "azSuelo",
    grimeTexture(scene, "azSueloT", { base: "#3f4144", speckle: 5200, stains: 16 }),
    MAP5[0].length,
    MAP5.length
  );
  const matMuro = texMat(scene, "azMuro", grimeTexture(scene, "azMuroT", { base: "#5a5c58", stains: 14, zocalo: "#3a3c38" }));
  const matPretil = texMat(scene, "azPretil", grimeTexture(scene, "azPretilT", { base: "#63655f", speckle: 2600, stains: 10 }));
  const matChapa = texMat(scene, "azChapa", grimeTexture(scene, "azChapaT", { base: "#6b7276", speckle: 2400, stains: 9 }));
  const matChapaOsc = colorMat(scene, "azChapaOsc", "#4a5054");
  const matTubo = colorMat(scene, "azTubo", "#7a7f82");
  const matRejilla = colorMat(scene, "azRejilla", "#3e4448");
  const matPaper = colorMat(scene, "azPaper", "#d6d0be", 0.12);
  const matHierro = colorMat(scene, "azHierro", "#565b5e");
  const matRojo = colorMat(scene, "azRojo", "#7a2a22", 0.3);
  const matVerde = colorMat(scene, "azVerde", "#2f7a3a", 0.3);
  const matAmbar = colorMat(scene, "azAmbar", "#c2a044", 0.35);

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
    const dt = new DynamicTexture("sg5_" + text, { width: texW, height: 64 }, scene, false, Texture.NEAREST_SAMPLINGMODE);
    dt.drawText(text, null, 44, "bold 38px 'Courier New'", fg, bg, true);
    const m = new StandardMaterial("sgm5_" + text, scene);
    m.diffuseTexture = dt;
    m.emissiveTexture = dt;
    m.emissiveColor = new Color3(0.55, 0.55, 0.55);
    m.specularColor = Color3.Black();
    // DOUBLESIDE con la UV de la cara trasera invertida: el rótulo se lee
    // igual de bien por detrás en vez de salir escrito del revés
    const p = MeshBuilder.CreatePlane(
      "sgp5_" + text,
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

  const W = MAP5[0].length * T; // 60
  const H = MAP5.length * T; // 40
  minimap.register(5, MAP5, Z_OFF);

  // ------------------------------------------------------------- cielo nocturno
  // Noche cerrada y nada más: degradado, estrellas y la luna. Sin skyline.
  const skyTex = new DynamicTexture("skyT", { width: 1024, height: 512 }, scene, false, Texture.BILINEAR_SAMPLINGMODE);
  {
    const c = skyTex.getContext() as unknown as CanvasRenderingContext2D;
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#04060d"); // cénit
    g.addColorStop(0.45, "#080d1a");
    g.addColorStop(0.72, "#0c1424");
    g.addColorStop(1, "#04050a"); // por debajo del horizonte
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 700; i++) {
      // más densas arriba, se van apagando hacia el horizonte
      const y = Math.pow(Math.random(), 0.75) * 400;
      const b = (0.3 + Math.random() * 0.7) * (1 - y / 560);
      c.fillStyle = `rgba(255,255,${230 + Math.random() * 25},${b})`;
      const s = Math.random() < 0.06 ? 2 : 1;
      c.fillRect(Math.random() * 1024, y, s, s);
    }
    skyTex.update();
  }
  const matSky = new StandardMaterial("azSkyM", scene);
  matSky.emissiveTexture = skyTex;
  matSky.diffuseColor = Color3.Black();
  matSky.specularColor = Color3.Black();
  matSky.disableLighting = true;
  matSky.backFaceCulling = false;
  const sky = MeshBuilder.CreateSphere("azSky", { diameter: 190, segments: 20, sideOrientation: Mesh.BACKSIDE }, scene);
  sky.material = matSky;
  sky.infiniteDistance = true; // siempre en el horizonte
  sky.applyFog = false;
  sky.isPickable = false;
  sky.setEnabled(false);

  // la luna: malla propia a distancia fija de la cámara, así se queda clavada
  // en el mismo punto del cielo por mucho que se recorra la azotea
  const lunaTex = new DynamicTexture("azLunaT", { width: 256, height: 256 }, scene, false, Texture.BILINEAR_SAMPLINGMODE);
  {
    const c = lunaTex.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, 256, 256);
    const halo = c.createRadialGradient(128, 128, 52, 128, 128, 126);
    halo.addColorStop(0, "rgba(198,212,245,0.42)");
    halo.addColorStop(0.45, "rgba(160,178,220,0.12)");
    halo.addColorStop(1, "rgba(150,170,215,0)");
    c.fillStyle = halo;
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = "#e6ecf8";
    c.beginPath();
    c.arc(128, 128, 52, 0, Math.PI * 2);
    c.fill();
    // mares lunares: manchas suaves, nada de cara sonriente
    for (const [mx, my, mr, a] of [
      [110, 112, 17, 0.3],
      [146, 142, 12, 0.24],
      [120, 152, 9, 0.2],
      [149, 106, 7, 0.16],
    ] as const) {
      c.fillStyle = `rgba(148,160,190,${a})`;
      c.beginPath();
      c.arc(mx, my, mr, 0, Math.PI * 2);
      c.fill();
    }
    lunaTex.update();
  }
  lunaTex.hasAlpha = true;
  const matLuna = new StandardMaterial("azLunaM", scene);
  matLuna.emissiveTexture = lunaTex;
  matLuna.opacityTexture = lunaTex;
  matLuna.diffuseColor = Color3.Black();
  matLuna.specularColor = Color3.Black();
  matLuna.disableLighting = true;
  const luna = MeshBuilder.CreatePlane("azLuna", { size: 22 }, scene);
  luna.material = matLuna;
  luna.billboardMode = Mesh.BILLBOARDMODE_ALL;
  luna.infiniteDistance = true; // la posición es un desvío desde la cámara
  // al norte y a media altura: se ve de frente nada más salir a la azotea
  luna.position.set(19.6, 20.5, -64);
  luna.applyFog = false;
  luna.isPickable = false;
  luna.setEnabled(false);

  // ------------------------------------------------------------- suelo y bordes
  const suelo = MeshBuilder.CreateGround("azGround", { width: W, height: H }, scene);
  suelo.position.set(W / 2, 0, Z_OFF + H / 2);
  suelo.material = matSuelo;
  suelo.checkCollisions = true;

  // muros ALTOS al norte y al oeste: encima hay más azotea
  const muroN = box("azMuroN", W, 5.2, 1.2, W / 2, 2.6, Z_OFF + 0.6, matMuro);
  const muroO = box("azMuroO", 1.2, 5.2, H, 0.6, 2.6, Z_OFF + H / 2, matMuro);
  // el borde de la azotea de arriba, para que se lea como otro nivel
  box("azCornisaN", W, 0.35, 1.9, W / 2, 5.3, Z_OFF + 0.95, matPretil, { collide: false });
  box("azCornisaO", 1.9, 0.35, H, 0.95, 5.3, Z_OFF + H / 2, matPretil, { collide: false });

  // pretiles BAJOS al sur y al este: desde aquí se ve el paisaje
  box("azPretilS", W, 1.15, 0.85, W / 2, 0.58, Z_OFF + H - 0.42, matPretil);
  box("azPretilE", 0.85, 1.15, H, W - 0.42, 0.58, Z_OFF + H / 2, matPretil);
  box("azAlbardaS", W, 0.16, 1.1, W / 2, 1.2, Z_OFF + H - 0.42, matChapaOsc, { collide: false });
  box("azAlbardaE", 1.1, 0.16, H, W - 0.42, 1.2, Z_OFF + H / 2, matChapaOsc, { collide: false });

  // ------------------------------------------------------------- casetón de bajada
  // Por aquí se sale del ala C: es donde aparece Mario y por donde ya no se
  // vuelve. Puerta cortafuegos que solo abre desde dentro.
  const BX = 49; // centro del casetón
  const BZ = Z_OFF + 36.4;
  box("azBajN", 5.6, 3.2, 0.3, BX, 1.6, BZ - 2.1, matMuro); // fachada con la puerta
  box("azBajS", 5.6, 3.2, 0.3, BX, 1.6, BZ + 2.1, matMuro);
  box("azBajE", 0.3, 3.2, 4.5, BX + 2.65, 1.6, BZ, matMuro);
  box("azBajO", 0.3, 3.2, 4.5, BX - 2.65, 1.6, BZ, matMuro);
  box("azBajTecho", 6.1, 0.28, 5.0, BX, 3.3, BZ, matChapaOsc, { collide: false });
  box("azBajMarcoO", 0.18, 2.5, 0.36, BX - 1.0, 1.25, BZ - 2.1, matHierro, { collide: false });
  box("azBajMarcoE", 0.18, 2.5, 0.36, BX + 1.0, 1.25, BZ - 2.1, matHierro, { collide: false });
  const puertaBaj = box("azBajPuerta", 1.8, 2.42, 0.12, BX, 1.21, BZ - 2.24, matChapaOsc);
  box("azBajBarra", 1.2, 0.09, 0.09, BX, 1.15, BZ - 2.32, matHierro, { collide: false });
  sign("ALA C — BAJADA", BX, 2.86, BZ - 2.28, Math.PI, "#cfc9b8", "#20221f", 2.4);
  game.register(puertaBaj, "azBajada", "Volver a bajar al ala C", () => {
    game.sfx.locked();
    game.notify("Cortafuegos. Se ha cerrado sola al salir y por fuera no tiene manilla. Desde aquí solo se sube.", 5200);
  });

  // ------------------------------------------------------------- maquinaria
  /** Unidad de clima: cajón de chapa con rejilla y tubos. */
  const climatizador = (x: number, z: number, w: number, d: number, alto = 1.9) => {
    box("azAC", w, alto, d, x, alto / 2, z, matChapa);
    box("azACtapa", w + 0.18, 0.16, d + 0.18, x, alto + 0.08, z, matChapaOsc, { collide: false });
    box("azACrej", w * 0.7, alto * 0.5, 0.06, x, alto * 0.55, z + d / 2 + 0.04, matRejilla, { collide: false });
    box("azACtubo", 0.34, 1.1, 0.34, x + w / 2 - 0.4, alto + 0.5, z - d / 2 + 0.4, matTubo, { collide: false });
  };
  climatizador(9, cz(2.5), 8, 4);
  climatizador(36, cz(2.5), 8, 4);
  climatizador(13, cz(9.5), 8, 4, 1.6);
  climatizador(9, cz(15.5), 8, 4, 1.7);
  climatizador(43, cz(9.5), 6, 4, 2.2);

  // conductos que serpentean por el suelo
  for (const [x1, z1, len, horiz] of [
    [8, cz(12.5), 6, true],
    [38, cz(12.5), 10, true],
    [24, cz(6), 8, false],
  ] as const) {
    if (horiz) {
      box("azCond", len, 0.7, 0.9, x1 + len / 2, 0.35, z1, matTubo);
      box("azCondTop", len, 0.12, 1.0, x1 + len / 2, 0.75, z1, matChapaOsc, { collide: false });
    } else {
      box("azCond", 0.9, 0.7, len, x1, 0.35, z1 + len / 2, matTubo);
      box("azCondTop", 1.0, 0.12, len, x1, 0.75, z1 + len / 2, matChapaOsc, { collide: false });
    }
  }

  // antena y farola de azotea
  box("azAntena", 0.18, 4.4, 0.18, 52, 2.2, cz(17), matHierro, { collide: false });
  for (let i = 0; i < 3; i++) box("azAntenaX", 1.5, 0.1, 0.1, 52, 2.6 + i * 0.7, cz(17), matHierro, { collide: false });

  // ------------------------------------------------------------- depósito de agua
  const dep = MeshBuilder.CreateCylinder("azDeposito", { diameter: 4.6, height: 3.2, tessellation: 16 }, scene);
  dep.position.set(43, 3.4, cz(9.5));
  dep.material = matChapa;
  dep.checkCollisions = true;
  for (const dx of [-1.7, 1.7]) {
    for (const dz of [-1.7, 1.7]) {
      box("azPata", 0.24, 1.8, 0.24, 43 + dx, 0.9, cz(9.5) + dz, matHierro);
    }
  }
  box("azBajante", 0.3, 3.6, 0.3, 45.4, 1.8, cz(9.5), matTubo, { collide: false });
  sign("DEPÓSITO — 4.000 L", 43, 5.2, cz(9.5) - 2.4, 0, "#cfc9b8", "#20221f", 2.4);

  // ------------------------------------------------------------- caseta de mantenimiento
  const CX = 25.5; // centro de la caseta
  const CZ = cz(6);
  box("azCasetaN", 7.4, 3, 0.3, CX, 1.5, CZ - 2.6, matMuro);
  box("azCasetaE", 0.3, 3, 5.2, CX + 3.55, 1.5, CZ, matMuro);
  box("azCasetaW", 0.3, 3, 5.2, CX - 3.55, 1.5, CZ, matMuro);
  box("azCasetaTecho", 7.8, 0.25, 5.6, CX, 3.1, CZ, matChapaOsc, { collide: false });
  // fachada sur: puerta atrancada (izquierda) y hueco de conducto (derecha),
  // con paso holgado: 2,1 m de ancho y dintel a 1,35 m para colarse agachado
  const HX = CX + 1.45; // centro del hueco
  box("azCasetaS1", 3.95, 3, 0.3, CX - 1.575, 1.5, CZ + 2.6, matMuro);
  box("azCasetaS2", 1.05, 3, 0.3, CX + 3.025, 1.5, CZ + 2.6, matMuro);
  box("azDintelCond", 2.1, 1.65, 0.3, HX, 2.175, CZ + 2.6, matMuro);
  const puerta = box("azPuerta", 1.5, 2.4, 0.14, CX - 1.6, 1.2, CZ + 2.68, matChapaOsc);
  sign("MANTENIMIENTO", CX - 1.6, 2.72, CZ + 2.78, Math.PI, "#d8e8f0", "#1d2a30", 2.2);
  sign("CONDUCTO", HX, 1.55, CZ + 2.78, Math.PI, "#cfc9b8", "#20221f", 1.3);

  const rejilla = box("azRejillaCond", 2.0, 1.25, 0.1, HX, 0.63, CZ + 2.62, matRejilla, { collide: true });
  const tornillos: Mesh[] = [];
  for (const dx of [-0.85, 0.85]) {
    for (const dy of [-0.45, 0.45]) {
      tornillos.push(box("azTorn", 0.09, 0.09, 0.05, HX + dx, 0.63 + dy, CZ + 2.68, matAmbar, { collide: false }));
    }
  }

  // ------------------------------------------------------------- escalera plegada
  const escX = 14;
  const escBaseZ = Z_OFF + 1.25;
  sign("ACCESO AZOTEA SUPERIOR", escX, 4.4, escBaseZ + 0.02, Math.PI, "#9fe89f", "#0d2010", 3.0);
  const escaleraRoot = MeshBuilder.CreateBox("azEscRoot", { size: 0.01 }, scene);
  escaleraRoot.position.set(escX, 3.9, escBaseZ);
  escaleraRoot.isVisible = false;
  escaleraRoot.isPickable = false;
  const larguero1 = box("azEscL1", 0.12, 3.4, 0.12, -0.55, 0, 0, matHierro, { collide: false });
  const larguero2 = box("azEscL2", 0.12, 3.4, 0.12, 0.55, 0, 0, matHierro, { collide: false });
  larguero1.parent = escaleraRoot;
  larguero2.parent = escaleraRoot;
  for (let i = 0; i < 8; i++) {
    const p = box("azEscP", 1.2, 0.08, 0.1, 0, -1.55 + i * 0.45, 0, matHierro, { collide: false });
    p.parent = escaleraRoot;
  }
  // plegada: recogida hacia arriba y pegada al muro
  escaleraRoot.rotation.x = -1.45;
  escaleraRoot.position.y = 4.6;
  const gancho = box("azGancho", 0.5, 0.3, 0.3, escX, 4.9, escBaseZ + 0.35, matRojo, { collide: false });

  // ------------------------------------------------------------- extractor
  // Uno solo, y a la vista del camino a la caseta: es el paso que hay que dar
  // antes de que el cuadro deje subir el automático del torno.
  const extAspa = box("azAspa", 1.15, 0.05, 0.16, 0, 0, 0, matChapaOsc, { collide: false });
  const extractor = MeshBuilder.CreateCylinder("azExt", { diameter: 1.6, height: 0.7, tessellation: 14 }, scene);
  extractor.position.set(32, 0.37, cz(7));
  extractor.material = matChapa;
  extractor.checkCollisions = true;
  extAspa.position.set(32, 0.72, cz(7));
  const extAspa2 = box("azAspa2", 1.15, 0.05, 0.16, 0, 0, 0, matChapaOsc, { collide: false });
  extAspa2.parent = extAspa;
  extAspa2.rotation.y = Math.PI / 2; // cruz de aspas
  sign("EXTRACTOR", 32, 1.15, cz(7) - 0.9, 0, "#cfc9b8", "#20221f", 1.4);

  // ------------------------------------------------------------- cuadro eléctrico
  const cuadroX = CX - 2.2;
  const cuadroZ = CZ - 2.3;
  box("azCuadro", 1.5, 1.1, 0.25, cuadroX, 1.55, cuadroZ, matChapaOsc, { collide: false });
  // una sola palanca: la del torno de la escalera
  const palanca = box("azPalanca", 0.3, 0.5, 0.22, cuadroX, 1.5, cuadroZ + 0.42, matRojo, { collide: false });
  sign("TORNO ESCALERA", cuadroX, 1.1, cuadroZ + 0.44, Math.PI, "#cfc9b8", "#20221f", 1.3);
  const luzCuadro = box("azLuzCuadro", 0.14, 0.14, 0.1, cuadroX + 0.62, 1.95, cuadroZ + 0.3, matRojo, { collide: false });

  // ------------------------------------------------------------- estado del puzle
  const pintarCuadro = () => {
    const on = !!state.get("az_luz");
    palanca.material = on ? matVerde : matRojo;
    palanca.rotation.x = on ? -0.5 : 0.5;
    luzCuadro.material = on ? matVerde : state.get("az_ext") ? matAmbar : matRojo;
  };
  pintarCuadro();

  const bajarEscalera = () => {
    if (state.get("az_escalera")) return;
    state.set("az_escalera");
    const ease = new SineEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    Animation.CreateAndStartAnimation("escRot", escaleraRoot, "rotation.x", 60, 90, escaleraRoot.rotation.x, 0, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    Animation.CreateAndStartAnimation("escPos", escaleraRoot, "position.y", 60, 90, escaleraRoot.position.y, 2.1, Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
    gancho.material = matVerde;
    game.sfx.unlock();
    game.sfx.doorCreak();
    setTimeout(() => game.sfx.thud(), 900);
    game.notify("El contrapeso cede y la escalera se despliega con estruendo.", 5200);
    updateObjective5();
  };

  // ------------------------------------------------------------- interacciones
  // La nota, sobre un cajón justo delante de la puerta de bajada: es lo primero
  // que se ve al salir y da los tres pasos del puzle en orden.
  box("azCajon", 0.8, 0.75, 0.6, 48.4, 0.37, BZ - 4.8, matChapa);
  const nota = box("azNota", 0.32, 0.014, 0.4, 48.4, 0.76, BZ - 4.8, matPaper, { collide: false });
  nota.rotation.y = -0.35;
  game.register(nota, "azNota", "Leer la nota", () => {
    state.set("az_nota");
    updateObjective5();
    game.talk(
      {
        n1: {
          speaker: "NOTA MANUSCRITA",
          text: "«El que lea esto: ARRIBA está la salida.\nLa escalera de la azotea de arriba está plegada\ny sujeta con un gancho. Para soltarla hay tres cosas.»",
          next: "n2",
        },
        n2: {
          text: "«UNO. La caseta de mantenimiento.\nLa puerta está atrancada por dentro: se entra por el\nconducto, quitando la rejilla y pasando agachado.»",
          next: "n3",
        },
        n3: {
          text: "«DOS. Dentro está el cuadro y la manivela.\nEl automático del torno no sube mientras el extractor\nesté agarrotado: van en la misma línea. Desatáscalo.»",
          next: "n4",
        },
        n4: {
          text: "«TRES. Con corriente y la manivela, abre la válvula\ndel depósito de agua. El contrapeso baja\ny la escalera se suelta sola. — F.»",
        },
      },
      "n1"
    );
  });

  game.register(puerta, "azPuerta", "Puerta de mantenimiento", () => {
    game.sfx.locked();
    game.notify("Atrancada por dentro con una barra. No cede.");
  });

  game.register(
    [rejilla, ...tornillos],
    "azRejilla",
    () => (state.has("destornillador") ? "Desatornillar la rejilla" : "Rejilla del conducto — atornillada"),
    () => {
      if (!state.has("destornillador")) {
        game.sfx.locked();
        game.notify("Cuatro tornillos de estrella. A mano, imposible.");
        return;
      }
      state.set("az_rejilla");
      rejilla.dispose();
      for (const t of tornillos) t.dispose();
      game.unregister("azRejilla");
      game.sfx.pickup();
      game.notify("La rejilla cede. El hueco es bajo: habrá que pasar agachado [C].", 5200);
      updateObjective5();
    }
  );

  // el extractor: se desatasca a mano, sin herramienta que buscar
  game.register(
    [extractor, extAspa],
    "azExtractor",
    () => (state.get("az_ext") ? "Extractor — ya gira libre" : "Desatascar el extractor"),
    () => {
      if (state.get("az_ext")) {
        game.notify("Gira suelto. Este ya está.");
        return;
      }
      state.set("az_ext");
      game.sfx.doorCreak();
      game.notify("Sacas del rodete un nido de trapos y plumas. Las aspas giran libres.", 4200);
      updateObjective5();
    }
  );

  // cuadro eléctrico: una palanca, y solo sube cuando el extractor está libre
  game.register(
    palanca,
    "azPalanca",
    () => (state.get("az_luz") ? "Automático del torno — subido" : "Subir el automático del torno"),
    () => {
      if (state.get("az_luz")) {
        game.notify("Ya hay corriente. Mejor no tocar nada más.");
        return;
      }
      if (!state.get("az_ext")) {
        // sin castigo: la palanca se cae sola y dice exactamente qué falta
        game.sfx.locked();
        game.notify("La palanca vuelve a caer sola: el extractor agarrotado va en la misma línea. Hay que desatascarlo antes.", 5600);
        state.set("az_visto_cuadro");
        updateObjective5();
        return;
      }
      state.set("az_luz");
      pintarCuadro();
      game.sfx.switchClick();
      game.sfx.unlock();
      game.notify("El torno zumba. Ya hay corriente en el gancho de la escalera.", 4600);
      updateObjective5();
    }
  );

  // manivela dentro de la caseta
  if (!state.has("manivela")) {
    const man = box("azManivela", 0.16, 0.56, 0.16, CX + 2.3, 1.25, CZ - 1.75, matHierro, { collide: false });
    const manBrazo = box("azManivelaB", 0.5, 0.14, 0.14, CX + 2.3, 1.56, CZ - 1.72, matHierro, { collide: false });
    box("azBanco", 1.6, 0.9, 0.7, CX + 2.3, 0.45, CZ - 1.9, matChapa); // banco de trabajo
    game.register([man, manBrazo], "azManivela", "Coger la manivela", () => {
      state.addItem({
        id: "manivela",
        name: "Manivela de la válvula",
        desc: "Hierro macizo, con la punta cuadrada. De las que abren cosas que llevan años cerradas.",
      });
      man.dispose();
      manBrazo.dispose();
      game.unregister("azManivela");
      game.sfx.pickup();
      game.notify("Manivela conseguida. La válvula del depósito la estaba esperando.", 4200);
      updateObjective5();
    });
  }

  // válvula del depósito: la fase final
  const valvula = MeshBuilder.CreateTorus("azValvula", { diameter: 0.55, thickness: 0.09, tessellation: 14 }, scene);
  valvula.position.set(45.4, 1.35, cz(9.5) + 0.35);
  valvula.rotation.x = Math.PI / 2;
  valvula.material = matHierro;
  valvula.isPickable = true;
  sign("VÁLVULA — CONTRAPESO", 45.4, 2.15, cz(9.5) + 0.5, 0, "#cfc9b8", "#20221f", 2.2);
  game.register(valvula, "azValvula", () => (state.get("az_escalera") ? "Válvula abierta" : "Válvula del contrapeso"), () => {
    if (state.get("az_escalera")) {
      game.notify("Ya está abierta. El depósito sigue vaciándose.");
      return;
    }
    if (!state.get("az_luz")) {
      game.sfx.locked();
      game.notify("La válvula es eléctrica: sin corriente en el torno no hace nada.");
      return;
    }
    if (!state.has("manivela")) {
      game.sfx.locked();
      game.notify("Falta la manivela: el vástago es un cuadradillo desnudo.");
      return;
    }
    Animation.CreateAndStartAnimation("valGiro", valvula, "rotation.y", 60, 110, valvula.rotation.y, valvula.rotation.y + Math.PI * 3, Animation.ANIMATIONLOOPMODE_CONSTANT);
    game.sfx.throwHit();
    setTimeout(bajarEscalera, 1400);
  });

  // subir por la escalera = fin del episodio
  game.register(
    [larguero1, larguero2, gancho],
    "azEscalera",
    () => (state.get("az_escalera") ? "Subir a la azotea superior" : "Escalera plegada — con gancho"),
    () => {
      if (!state.get("az_escalera")) {
        game.sfx.locked();
        state.set("az_vista_escalera");
        updateObjective5();
        game.notify("Plegada a cinco metros y sujeta por un gancho rojo. Ni saltando.");
        return;
      }
      state.set("nivel4_completado");
      game.sfx.doorCreak();
      setTimeout(() => {
        game.endLevel(
          "Mario subió los ocho peldaños de la escalera.\n" +
            "Arriba, la azotea superior era más pequeña de lo que parecía\ndesde abajo... y no estaba vacía.\n\n" +
            "Había una silla. Una mesa. Un flexo encendido.\n" +
            "Y sobre la mesa, un tomo abierto con la tinta aún fresca,\nesperando a que alguien escribiera la siguiente línea.\n\n" +
            "La campana no sonó.\nNo hacía falta: ya estaba donde tenía que estar.\n\n" +
            "FIN DEL EPISODIO 4\n— continuará —"
        );
      }, 1200);
    }
  );

  // ------------------------------------------------------------- ambiente
  game.onUpdate.push((dt) => {
    if (state.get("nivel") !== 5) return;
    // las aspas giran en cuanto el extractor está libre y hay corriente
    if (state.get("az_ext")) extAspa.rotation.y += dt * (state.get("az_luz") ? 9 : 1.2);
  });

  // ------------------------------------------------------------- objetivos
  const updateObjective5 = () => {
    if (state.get("nivel") !== 5) return;
    if (state.get("az_escalera")) return game.setObjective("Sube por la escalera a la azotea superior.");
    if (state.get("az_luz") && !state.has("manivela"))
      return game.setObjective("Hay corriente.\nCoge la manivela del banco de la caseta.");
    if (state.get("az_luz")) return game.setObjective("Abre con la manivela la válvula del contrapeso\n(junto al depósito de agua).");
    if (state.get("az_rejilla") && !state.get("az_ext"))
      return game.setObjective("Desatasca el extractor.\nSin él, el automático del torno no sube.");
    if (state.get("az_rejilla"))
      return game.setObjective("Sube el automático del torno\nen el cuadro de la caseta.");
    if (state.get("az_nota")) return game.setObjective("Entra en la caseta de mantenimiento:\nquita la rejilla del conducto y pasa agachado [C].");
    game.setObjective("Azotea del ala C.\nLee la nota del cajón para saber por dónde empezar.");
  };

  // ------------------------------------------------------------- luces y transición
  const placeLights5 = () => {
    const L = game.levelLights;
    const set = (i: number, x: number, z: number, intensity: number, range: number, color?: Color3) => {
      const l = L[i];
      if (!l) return;
      l.position.set(x, 3.2, z);
      l.intensity = intensity;
      l.range = range;
      if (color) l.diffuse = color;
    };
    const lunar = new Color3(0.62, 0.7, 0.95);
    const sodio = new Color3(1, 0.76, 0.42);
    set(0, 14, Z_OFF + 4, 0.42, 14, sodio); // sobre la escalera
    set(1, 30, Z_OFF + 12, 0.3, 16, lunar);
    set(2, 45, Z_OFF + 20, 0.34, 15, lunar);
    set(3, CX, CZ, 0.4, 9, sodio); // caseta
    set(4, 32, cz(7) + 1, 0.32, 13, lunar); // el extractor
    set(5, 46, Z_OFF + 27, 0.28, 12, sodio);
    set(6, 8, Z_OFF + 22, 0.26, 12, lunar);
    set(7, 48.6, BZ - 3.6, 0.5, 11, sodio); // sobre la puerta de bajada y la nota
  };

  game.enterLevel5 = async () => {
    if (state.get("nivel") === 5) return;
    game.playing = false;
    game.player.setControl(false);
    await hud.fade(true, 1500);
    state.set("nivel", 5);
    placeLights5();
    sky.setEnabled(true);
    luna.setEnabled(true);
    // el cielo pide aire: la niebla cerrada de interiores no vale
    scene.fogDensity = 0.006;
    scene.fogColor = new Color3(0.05, 0.06, 0.09);
    const cam = game.player.camera;
    cam.maxZ = 400;
    // saliendo del casetón de bajada, mirando hacia el resto de la azotea
    cam.position.set(49, 1.62, BZ - 3.4);
    cam.rotation.set(0.12, Math.PI, 0);
    updateObjective5();
    hud.setLocation("AZOTEA · ALA C");
    game.savePlayer();
    await game.interlude([
      "AZOTEA DEL ALA C",
      "4:26 AM",
      "Aire. Aire de verdad, por primera vez en 217 días.",
      "Y sobre tu cabeza, otra azotea.\nSiempre hay algo más arriba.",
    ]);
    game.playing = true;
    game.player.setControl(true);
    await hud.fade(false, 1800);
    game.checkPause();
  };

  if (state.get("nivel") === 5) {
    placeLights5();
    sky.setEnabled(true);
    luna.setEnabled(true);
    scene.fogDensity = 0.006;
    scene.fogColor = new Color3(0.05, 0.06, 0.09);
    game.player.camera.maxZ = 400;
    updateObjective5();
  }
}
