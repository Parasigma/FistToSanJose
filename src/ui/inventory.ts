import {
  Camera,
  Color3,
  Color4,
  Effect,
  Engine,
  FreeCamera,
  HemisphericLight,
  PostProcess,
  Scene,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { buildItemModel } from "../game/models";
import { GameState, ItemDef } from "../game/state";

const $ = (id: string) => document.getElementById(id)!;

/**
 * Inventario en rejilla: cada casilla muestra su objeto girando en 3D.
 * Los modelos viven en una mini-escena aparte que se pinta en un lienzo
 * transparente (#ui3d) por encima del panel del HUD.
 */
export class InventoryUI {
  isOpen = false;
  examining = false;

  private sel = 0;
  private items: ItemDef[] = [];
  private cells: HTMLDivElement[] = [];
  private models: (TransformNode | null)[] = [];
  private exModel: TransformNode | null = null;
  private stateRef: GameState | null = null;

  // arrastrar y soltar con el ratón
  private dragIdx = -1;
  private dragActive = false;
  private dropIdx = -1;
  private dragX = 0;
  private dragY = 0;

  private engine2: Engine | null = null;
  private scene2: Scene | null = null;
  private cam2: FreeCamera | null = null;
  private t = 0;

  private ensureOverlay() {
    if (this.engine2) return;
    const canvas = $("ui3d") as HTMLCanvasElement;
    // antialias + resolución nativa (DPR): los objetos se ven nítidos,
    // el toque retro ya lo pone el low-poly
    this.engine2 = new Engine(canvas, true, undefined, true);
    const scene2 = new Scene(this.engine2);
    scene2.clearColor = new Color4(0, 0, 0, 0);
    const cam = new FreeCamera("invCam", new Vector3(0, 0, -600), scene2);
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA;
    cam.setTarget(Vector3.Zero());
    cam.minZ = 1;
    cam.maxZ = 2000;
    const hl = new HemisphericLight("invLight", new Vector3(0.35, 1, -0.6), scene2);
    hl.intensity = 0.95;
    hl.groundColor = new Color3(0.25, 0.24, 0.22);
    this.scene2 = scene2;
    this.cam2 = cam;

    // CRT/PSX suave a resolución nativa: cuantización con dithering fino,
    // líneas de escaneo y grano, respetando la transparencia del lienzo
    Effect.ShadersStore["invCrtFragmentShader"] = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      uniform float time;
      float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(void) {
        vec4 c = texture2D(textureSampler, vUV);
        float d = (bayer4(gl_FragCoord.xy * 0.5) - 0.5) / 26.0;
        c.rgb = clamp(c.rgb + d * c.a, 0.0, 1.0);
        c.rgb = floor(c.rgb * 23.0 + 0.5) / 23.0;
        float scan = 0.86 + 0.14 * step(1.5, mod(gl_FragCoord.y, 3.0));
        c.rgb *= scan;
        float g = hash(vUV * 41.0 + fract(time * 13.7) * 17.0);
        c.rgb += (g - 0.5) * 0.05 * c.a;
        gl_FragColor = c;
      }`;
    const pp = new PostProcess("invCrt", "invCrt", ["time"], null, 1.0, cam, Texture.BILINEAR_SAMPLINGMODE);
    let ppT = 0;
    pp.onApply = (fx) => {
      ppT += this.engine2!.getDeltaTime() / 1000;
      fx.setFloat("time", ppT);
    };

    scene2.onBeforeRenderObservable.add(() => {
      const dt = this.engine2!.getDeltaTime() / 1000;
      this.t += dt;
      this.models.forEach((m, i) => {
        if (m && m.isEnabled()) {
          m.rotation.y += dt * 1.0;
          m.rotation.x = 0.28 + Math.sin(this.t * 0.9 + i) * 0.1;
        }
      });
      if (this.exModel) {
        this.exModel.rotation.y += dt * 1.1;
        this.exModel.rotation.x = 0.28 + Math.sin(this.t * 0.8) * 0.12;
      }
    });
    this.engine2.runRenderLoop(() => {
      if (this.isOpen) scene2.render();
    });
    window.addEventListener("resize", () => {
      this.engine2?.resize();
      this.updateOrtho();
    });
    this.updateOrtho();

    // clic en la vista de examinar = volver
    $("examine").addEventListener("click", () => this.closeExamine());

    // arrastrar y soltar entre casillas
    document.addEventListener("mousemove", (e) => {
      if (this.dragIdx < 0 || !this.isOpen || this.examining) return;
      if (!this.dragActive) {
        const d = Math.hypot(e.clientX - this.dragX, e.clientY - this.dragY);
        if (d > 8) {
          this.dragActive = true;
          this.cells[this.dragIdx]?.classList.add("dragging");
        }
      }
    });
    document.addEventListener("mouseup", () => {
      if (this.dragIdx < 0) return;
      const src = this.dragIdx;
      const dst = this.dropIdx;
      const wasDrag = this.dragActive;
      this.cells.forEach((c) => c.classList.remove("dragging", "drop"));
      this.dragIdx = -1;
      this.dragActive = false;
      this.dropIdx = -1;
      if (wasDrag && dst >= 0 && dst !== src) this.reorder(src, dst);
    });
  }

  /** Recoloca un objeto en otro hueco (el orden se conserva en la partida). */
  private reorder(src: number, dst: number) {
    const st = this.stateRef;
    if (!st || src >= st.items.length) return;
    if (dst >= st.items.length) dst = st.items.length - 1;
    const [it] = st.items.splice(src, 1);
    st.items.splice(dst, 0, it);
    this.items = st.items.slice();
    this.sel = dst;
    this.buildSlots();
    this.updateSel();
  }

  private updateOrtho() {
    if (!this.cam2) return;
    const canvas = $("ui3d") as HTMLCanvasElement;
    const W = canvas.clientWidth || window.innerWidth;
    const H = canvas.clientHeight || window.innerHeight;
    this.cam2.orthoLeft = -W / 2;
    this.cam2.orthoRight = W / 2;
    this.cam2.orthoTop = H / 2;
    this.cam2.orthoBottom = -H / 2;
  }

  toggle(state: GameState) {
    if (this.isOpen) this.close();
    else this.open(state);
  }

  open(state: GameState) {
    // mostrar el lienzo ANTES de crear/redimensionar el motor:
    // oculto mide 0 y el buffer quedaría en miniatura (imagen borrosa)
    $("ui3d").classList.add("on");
    this.ensureOverlay();
    this.engine2!.resize();
    this.updateOrtho();
    this.isOpen = true;
    this.sel = 0;
    this.stateRef = state;
    this.items = state.items.slice();
    $("inventory").classList.remove("hidden");
    this.buildSlots();
    this.updateSel();
  }

  private disposeModels() {
    for (const m of this.models) m?.dispose();
    this.models = [];
  }

  private buildSlots() {
    this.disposeModels();
    const grid = $("inv-grid");
    grid.innerHTML = "";
    this.cells = [];
    const total = Math.max(8, Math.ceil(this.items.length / 4) * 4);
    $("inv-count").textContent = `${this.items.length} / ${total}`;
    for (let i = 0; i < total; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      if (i < this.items.length) {
        // clic: seleccionar · doble clic: examinar · arrastrar: reordenar
        slot.onclick = () => {
          if (this.dragActive) return;
          this.sel = i;
          this.updateSel();
        };
        slot.ondblclick = () => {
          this.sel = i;
          this.updateSel();
          this.examineSelected();
        };
        slot.onmousedown = (e) => {
          this.dragIdx = i;
          this.dragActive = false;
          this.dropIdx = -1;
          this.dragX = e.clientX;
          this.dragY = e.clientY;
        };
      } else {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.textContent = "·";
        slot.appendChild(dot);
      }
      slot.onmouseenter = () => {
        if (!this.dragActive) return;
        this.cells.forEach((c) => c.classList.remove("drop"));
        this.dropIdx = i;
        if (i !== this.dragIdx) slot.classList.add("drop");
      };
      grid.appendChild(slot);
      this.cells.push(slot);
    }
    // colocar los modelos 3D sobre cada casilla (coordenadas de pantalla)
    const canvas = $("ui3d") as HTMLCanvasElement;
    const W = canvas.clientWidth || window.innerWidth;
    const H = canvas.clientHeight || window.innerHeight;
    this.items.forEach((it, i) => {
      const r = this.cells[i].getBoundingClientRect();
      const model = buildItemModel(this.scene2!, it.id);
      if (!model) {
        this.models.push(null);
        return;
      }
      const b = model.getHierarchyBoundingVectors();
      const ext = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) || 1;
      model.scaling.setAll((r.width * 0.58) / ext);
      model.position.set(r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2), 0);
      model.rotation.set(0.28, Math.random() * 3, 0);
      this.models.push(model);
    });
  }

  private updateSel() {
    this.cells.forEach((c, i) => c.classList.toggle("sel", i === this.sel && i < this.items.length));
    const it = this.items[this.sel];
    $("inv-name").textContent = it ? it.name.toUpperCase() : "—";
    $("inv-desc").textContent = it ? it.desc : this.items.length ? "" : "No llevas nada. Ni siquiera recuerdos claros.";
  }

  move(d: number) {
    if (!this.items.length || this.examining) return;
    this.sel = (this.sel + d + this.items.length) % this.items.length;
    this.updateSel();
  }

  moveRow(dir: number) {
    if (!this.items.length || this.examining) return;
    const target = this.sel + dir * 4;
    if (target >= 0 && target < this.items.length) {
      this.sel = target;
      this.updateSel();
    }
  }

  examineSelected() {
    if (!this.isOpen || this.examining) return;
    const it = this.items[this.sel];
    if (!it || !this.scene2) return;
    this.examining = true;
    $("inventory").classList.add("hidden");
    for (const m of this.models) m?.setEnabled(false);
    $("ex-name").textContent = it.name.toUpperCase();
    $("ex-desc").textContent = it.desc;
    $("examine").classList.remove("hidden");
    const canvas = $("ui3d") as HTMLCanvasElement;
    const W = canvas.clientWidth || window.innerWidth;
    const H = canvas.clientHeight || window.innerHeight;
    this.exModel = buildItemModel(this.scene2, it.id);
    if (this.exModel) {
      const b = this.exModel.getHierarchyBoundingVectors();
      const ext = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) || 1;
      // más pequeño y algo elevado: la descripción de abajo queda siempre libre
      this.exModel.scaling.setAll((Math.min(W, H) * 0.26) / ext);
      this.exModel.position.set(0, H * 0.08, 0);
      this.exModel.rotation.set(0.28, 0, 0);
    }
  }

  closeExamine() {
    if (!this.examining) return;
    this.examining = false;
    this.exModel?.dispose();
    this.exModel = null;
    $("examine").classList.add("hidden");
    if (this.isOpen) {
      $("inventory").classList.remove("hidden");
      for (const m of this.models) m?.setEnabled(true);
    }
  }

  close() {
    this.closeExamine();
    this.disposeModels();
    this.isOpen = false;
    this.cells = [];
    $("inventory").classList.add("hidden");
    $("ui3d").classList.remove("on");
  }
}
