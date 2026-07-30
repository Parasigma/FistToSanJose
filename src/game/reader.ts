import {
  Color3,
  DynamicTexture,
  FreeCamera,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector4,
} from "@babylonjs/core";

/** Qué se está leyendo: cambia el papel, la tipografía y si hay tapa que abrir. */
export type PaperKind = "nota" | "expediente" | "archivo";

/** Encabezados que se leen en la mano en vez de "a distancia". */
const RE_PAPEL = /^(NOTA|CARTA|CIRCULAR|POSTAL|TELEGRAMA)\b/;
const RE_EXPEDIENTE = /^(EXPEDIENTE|EXP\.|FICHA|INFORME|PARTE|HISTORIAL)\b/;
const RE_ARCHIVO = /^(ARCHIVO|LIBRO|REGISTRO|TOMO)\b/;

/** Deduce del encabezado si esto es un documento que se coge con la mano. */
export function inferPaper(speaker?: string): PaperKind | null {
  if (!speaker) return null;
  if (RE_PAPEL.test(speaker)) return "nota";
  if (RE_EXPEDIENTE.test(speaker)) return "expediente";
  if (RE_ARCHIVO.test(speaker)) return "archivo";
  return null;
}

const W = 512;
const H = 704;

/**
 * El documento que se lee en la mano: sube desde fuera de cuadro, se abre si
 * lleva tapa y se queda delante de la cámara mientras dura el diálogo.
 */
export class PaperReader {
  private root: TransformNode;
  private hoja!: Mesh;
  private tapa!: Mesh;
  private tapaPivot!: TransformNode;
  private mano: Mesh[] = [];
  private tex: DynamicTexture;
  private ctx: CanvasRenderingContext2D;
  private kind: PaperKind = "nota";

  /** 0 = fuera de cuadro, 1 = delante de la cara. */
  private t = 0;
  private objetivo = 0;
  /** 0 = tapa cerrada, 1 = tapa abierta del todo. */
  private abierta = 0;
  private ultimo = performance.now();

  constructor(private scene: Scene, camera: FreeCamera) {
    this.root = new TransformNode("paperRoot", scene);
    this.root.parent = camera;

    this.tex = new DynamicTexture("paperTex", { width: W, height: H }, scene, false, Texture.NEAREST_SAMPLINGMODE);
    this.ctx = this.tex.getContext() as unknown as CanvasRenderingContext2D;

    this.build();
    this.root.setEnabled(false);

    // reloj real: el delta del motor puede venir a cero en cuadros perdidos
    scene.onBeforeRenderObservable.add(() => this.tick());
  }

  // ------------------------------------------------------------- construcción
  private build() {
    const scene = this.scene;

    const matHoja = new StandardMaterial("paperMat", scene);
    matHoja.diffuseTexture = this.tex;
    matHoja.emissiveTexture = this.tex;
    // sin depender de las luces del nivel: un papel a un palmo de la cara
    // siempre se lee, aunque el pasillo esté a oscuras
    matHoja.disableLighting = true;
    matHoja.specularColor = Color3.Black();

    this.hoja = MeshBuilder.CreatePlane(
      "paperHoja",
      {
        width: 0.37,
        height: 0.37 * (H / W),
        sideOrientation: Mesh.DOUBLESIDE,
        frontUVs: new Vector4(0, 0, 1, 1),
        backUVs: new Vector4(1, 0, 0, 1),
      },
      scene
    );
    this.hoja.material = matHoja;
    this.hoja.parent = this.root;
    this.hoja.rotation.y = Math.PI; // la cara impresa mira a la cámara

    // tapa de carpeta: bisagra en el canto izquierdo, se abre hacia fuera
    const matTapa = new StandardMaterial("paperTapaMat", scene);
    matTapa.diffuseTexture = this.tapaTexture();
    matTapa.emissiveTexture = matTapa.diffuseTexture;
    matTapa.disableLighting = true;
    matTapa.specularColor = Color3.Black();

    this.tapaPivot = new TransformNode("paperTapaPivot", scene);
    this.tapaPivot.parent = this.root;
    this.tapaPivot.position.set(-0.195, 0, -0.004);

    this.tapa = MeshBuilder.CreatePlane(
      "paperTapa",
      {
        width: 0.39,
        height: 0.39 * (H / W) + 0.01,
        sideOrientation: Mesh.DOUBLESIDE,
        frontUVs: new Vector4(0, 0, 1, 1),
        backUVs: new Vector4(1, 0, 0, 1),
      },
      scene
    );
    this.tapa.material = matTapa;
    this.tapa.parent = this.tapaPivot;
    this.tapa.position.x = 0.195;
    this.tapa.rotation.y = Math.PI;

    // la mano: cuatro dedos y un pulgar sujetando el canto de abajo
    const piel = new StandardMaterial("paperMano", scene);
    piel.diffuseColor = Color3.FromHexString("#a87a5c");
    piel.emissiveColor = Color3.FromHexString("#a87a5c").scale(0.45);
    piel.specularColor = Color3.Black();

    // la mano agarra la esquina inferior izquierda: los dedos quedan detrás de
    // la hoja y solo asoman la palma y el pulgar, como al sujetar un papel
    const manoRoot = new TransformNode("paperManoRoot", scene);
    manoRoot.parent = this.root;
    manoRoot.position.set(-0.155, -0.265, 0);
    manoRoot.rotation.z = 0.34;
    const trozo = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => {
      const m = MeshBuilder.CreateBox("paperMano", { width: w, height: h, depth: d }, scene);
      m.material = piel;
      m.position.set(x, y, z);
      m.rotation.z = rz;
      m.parent = manoRoot;
      this.mano.push(m);
      return m;
    };
    trozo(0.115, 0.1, 0.055, -0.01, -0.055, 0.022); // palma, por debajo del canto
    for (let i = 0; i < 3; i++) trozo(0.03, 0.105, 0.032, -0.035 + i * 0.038, 0.025, 0.026); // dedos, detrás
    trozo(0.036, 0.075, 0.03, 0.012, 0.012, -0.024, -0.35); // pulgar, por delante

    for (const m of [this.hoja, this.tapa, ...this.mano]) {
      m.renderingGroupId = 1; // por encima de la geometría del nivel
      m.isPickable = false;
      m.applyFog = false;
    }
  }

  /** Cartulina de carpeta: manila con etiqueta y una banda de color. */
  private tapaTexture() {
    const t = new DynamicTexture("paperTapaTex", { width: 256, height: 352 }, this.scene, false, Texture.NEAREST_SAMPLINGMODE);
    const c = t.getContext() as unknown as CanvasRenderingContext2D;
    c.fillStyle = "#b39a68";
    c.fillRect(0, 0, 256, 352);
    for (let i = 0; i < 2400; i++) {
      c.fillStyle = `rgba(0,0,0,${Math.random() * 0.09})`;
      c.fillRect(Math.random() * 256, Math.random() * 352, 2, 2);
    }
    c.fillStyle = "#8d7647";
    c.fillRect(0, 0, 256, 26);
    c.fillStyle = "#6d2b22";
    c.fillRect(0, 300, 256, 12);
    c.fillStyle = "#e8e2cf";
    c.fillRect(26, 60, 204, 96);
    c.strokeStyle = "#7d6a44";
    c.strokeRect(26, 60, 204, 96);
    c.fillStyle = "#2b2620";
    c.font = "bold 17px 'Courier New'";
    c.fillText("SANATORIO", 40, 92);
    c.fillText("SAN JOSÉ", 40, 114);
    c.font = "13px 'Courier New'";
    c.fillText("ARCHIVO CLÍNICO", 40, 140);
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 3;
    c.strokeRect(3, 3, 250, 346);
    t.update();
    return t;
  }

  // ------------------------------------------------------------- dibujo
  private drawSheet(kind: PaperKind, titulo: string, cuerpo: string) {
    const c = this.ctx;
    const manuscrito = kind === "nota";
    const fondo = manuscrito ? "#d9d2bd" : kind === "archivo" ? "#dcd8c8" : "#e4e0d2";
    c.fillStyle = fondo;
    c.fillRect(0, 0, W, H);

    // grano y manchas: nada de papel recién salido de la impresora
    for (let i = 0; i < 5200; i++) {
      c.fillStyle = `rgba(90,78,55,${Math.random() * 0.13})`;
      c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    for (let i = 0; i < 7; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = 18 + Math.random() * 46;
      const g = c.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, "rgba(120,96,52,0.16)");
      g.addColorStop(1, "rgba(120,96,52,0)");
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    if (kind === "archivo") {
      // pauta de libro de registro
      c.strokeStyle = "rgba(60,80,110,0.28)";
      c.lineWidth = 1;
      for (let y = 150; y < H - 30; y += 34) {
        c.beginPath();
        c.moveTo(38, y);
        c.lineTo(W - 34, y);
        c.stroke();
      }
      c.strokeStyle = "rgba(150,60,50,0.35)";
      c.beginPath();
      c.moveTo(74, 108);
      c.lineTo(74, H - 30);
      c.stroke();
    } else if (kind === "expediente") {
      // membrete mecanografiado
      c.fillStyle = "#3a332a";
      c.fillRect(34, 34, W - 68, 3);
      c.font = "bold 19px 'Courier New'";
      c.fillText("SANATORIO SAN JOSÉ", 36, 66);
      c.font = "14px 'Courier New'";
      c.fillStyle = "#5a5145";
      c.fillText("SERVICIO DE ARCHIVO — USO INTERNO", 36, 88);
      c.fillStyle = "#3a332a";
      c.fillRect(34, 100, W - 68, 2);
      // sello escorado
      c.save();
      c.translate(W - 128, H - 118);
      c.rotate(-0.22);
      c.strokeStyle = "rgba(140,44,36,0.6)";
      c.lineWidth = 4;
      c.strokeRect(-70, -30, 140, 60);
      c.fillStyle = "rgba(140,44,36,0.6)";
      c.font = "bold 22px 'Courier New'";
      c.textAlign = "center";
      c.fillText("RESERVADO", 0, 8);
      c.textAlign = "left";
      c.restore();
    }

    // título
    const yTitulo = kind === "expediente" ? 132 : 74;
    c.fillStyle = manuscrito ? "#2c3550" : "#2b2620";
    c.font = manuscrito ? "bold 24px 'Courier New'" : "bold 22px 'Courier New'";
    c.fillText(this.recorta(c, titulo.toUpperCase(), W - 76), 38, yTitulo);
    c.fillStyle = "rgba(60,50,40,0.5)";
    c.fillRect(38, yTitulo + 12, W - 76, 2);

    // cuerpo: se encoge la tipografía hasta que quepa entero
    const yIni = yTitulo + 48;
    const alto = H - yIni - 46;
    const fuente = (px: number) =>
      manuscrito
        ? `italic ${px}px 'Segoe Script','Bradley Hand','Comic Sans MS',cursive`
        : `${px}px 'Courier New'`;
    let px = manuscrito ? 30 : 26;
    let lineas: string[] = [];
    for (; px >= 13; px -= 1) {
      c.font = fuente(px);
      lineas = this.envuelve(c, cuerpo, W - 80);
      if (lineas.length * (px * 1.42) <= alto) break;
    }
    c.font = fuente(px);
    c.fillStyle = manuscrito ? "#232a44" : "#282420";
    const lh = px * 1.42;
    lineas.forEach((l, i) => c.fillText(l, 40, yIni + i * lh));

    this.tex.update();
  }

  private recorta(c: CanvasRenderingContext2D, s: string, max: number) {
    if (c.measureText(s).width <= max) return s;
    let r = s;
    while (r.length > 4 && c.measureText(r + "…").width > max) r = r.slice(0, -1);
    return r + "…";
  }

  private envuelve(c: CanvasRenderingContext2D, texto: string, max: number) {
    const out: string[] = [];
    for (const parrafo of texto.split("\n")) {
      if (!parrafo.trim()) {
        out.push("");
        continue;
      }
      let linea = "";
      for (const palabra of parrafo.split(" ")) {
        const prueba = linea ? linea + " " + palabra : palabra;
        if (c.measureText(prueba).width > max && linea) {
          out.push(linea);
          linea = palabra;
        } else {
          linea = prueba;
        }
      }
      out.push(linea);
    }
    return out;
  }

  // ------------------------------------------------------------- animación
  private tick() {
    const ahora = performance.now();
    const dt = Math.min(0.1, (ahora - this.ultimo) / 1000);
    this.ultimo = ahora;
    if (this.t === this.objetivo && (this.objetivo === 0 || this.abierta === this.destinoTapa())) {
      if (this.objetivo === 0 && this.root.isEnabled()) this.root.setEnabled(false);
      return;
    }

    const v = 3.4;
    if (this.t < this.objetivo) this.t = Math.min(this.objetivo, this.t + dt * v);
    else this.t = Math.max(this.objetivo, this.t - dt * v);

    // la tapa solo se abre cuando el documento ya está arriba
    const destino = this.destinoTapa();
    if (this.abierta < destino) this.abierta = Math.min(destino, this.abierta + dt * 2.1);
    else if (this.abierta > destino) this.abierta = Math.max(destino, this.abierta - dt * 4);

    // arriba deja libre el cuarto inferior de la pantalla: ahí va el diálogo
    const e = this.t * this.t * (3 - 2 * this.t); // suavizado
    this.root.position.set(0.03 - 0.05 * (1 - e), -0.64 + 0.76 * e, 0.46 + 0.22 * e);
    this.root.rotation.set(0.95 * (1 - e) - 0.05, -0.5 * (1 - e), 0.42 * (1 - e) + 0.02);
    this.tapaPivot.rotation.y = -this.abierta * 2.5;

    if (this.t === 0 && this.objetivo === 0) this.root.setEnabled(false);
  }

  private destinoTapa() {
    if (this.kind === "nota") return 0;
    return this.t >= 0.97 && this.objetivo === 1 ? 1 : 0;
  }

  // ------------------------------------------------------------- API
  show(kind: PaperKind, titulo: string, cuerpo: string) {
    this.kind = kind;
    this.tapa.setEnabled(kind !== "nota");
    this.drawSheet(kind, titulo, cuerpo);
    this.root.setEnabled(true);
    this.ultimo = performance.now();
    this.objetivo = 1;
  }

  /** Cambia el texto sin volver a levantar el documento (pasar de página). */
  update(titulo: string, cuerpo: string) {
    this.drawSheet(this.kind, titulo, cuerpo);
  }

  hide() {
    this.objetivo = 0;
  }

  get visible() {
    return this.objetivo === 1;
  }
}
