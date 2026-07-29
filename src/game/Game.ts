import {
  AbstractMesh,
  Color3,
  Color4,
  Engine,
  PointLight,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { Player } from "../core/player";
import { setupPSX } from "../core/psx";
import { Sfx } from "../core/sfx";
import { Dialogue, DTree } from "../ui/dialogue";
import { hud } from "../ui/hud";
import { InventoryUI } from "../ui/inventory";
import { JournalUI } from "../ui/journal";
import { Keypad } from "../ui/keypad";
import { minimap } from "../ui/minimap";
import { buildLevel1 } from "./level1";
import { buildLevel2 } from "./level2";
import { buildLevel3 } from "./level3";
import { buildLevel4 } from "./level4";
import { GameState, SaveData } from "./state";

export interface Interactable {
  label: () => string;
  action: () => void;
  enabled?: () => boolean;
}

const $ = (id: string) => document.getElementById(id)!;

export class Game {
  engine: Engine;
  scene: Scene;
  player!: Player;
  sfx = new Sfx();
  state = new GameState();
  dialogue = new Dialogue();
  inventory = new InventoryUI();
  journal = new JournalUI();
  keypad!: Keypad;
  playing = false;
  ended = false;
  /** Interacción modal a pantalla (p. ej. la tele): bloquea el resto. */
  modal = false;
  onUpdate: Array<(dt: number) => void> = [];
  /** Luces puntuales del nivel activo (se recolocan al cambiar de planta). */
  levelLights: PointLight[] = [];
  /** Lo instala level1; sube de vuelta a la planta 2. */
  enterLevel1: (() => void) | null = null;
  /** Lo instala level2; lo invoca la puerta de la escalera del nivel 1. */
  enterLevel2: (() => void) | null = null;
  /** Lo instala level3; lo invoca la antesala del portón del Archivo. */
  enterLevel3: (() => void) | null = null;
  /** Lo instala level4; lo invoca la puerta del ALA C del Archivo. */
  enterLevel4: (() => void) | null = null;

  private interactables = new Map<string, Interactable>();
  private currentTarget: Interactable | null = null;
  private lockEverWorked = false;
  private lockFallback = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, false, undefined, false);
    this.scene = new Scene(this.engine);
  }

  async start(save: SaveData | null) {
    const scene = this.scene;
    scene.clearColor = new Color4(0.008, 0.008, 0.012, 1);
    scene.collisionsEnabled = true;
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.03;
    scene.fogColor = new Color3(0.015, 0.015, 0.024);

    const spawn = save
      ? new Vector3(save.pos.x, 1.62, save.pos.z)
      : new Vector3(5, 1.62, 5);
    this.player = new Player(scene, this.canvas, spawn, save ? save.pos.ry : 0.15);
    this.player.onStep = () => this.sfx.step();
    setupPSX(this.engine, this.player.camera);
    this.keypad = new Keypad(this.sfx);
    this.dialogue.onBlip = () => this.sfx.blip();

    if (save) this.state.restore(save);
    // la linterna hay que encontrarla: sin ella, ni modelo en mano ni foco
    this.player.setFlashlightHidden(!this.state.has("linterna"));
    buildLevel1(this);
    buildLevel2(this);
    buildLevel3(this);
    buildLevel4(this);
    const nivel = (this.state.get("nivel") as number) ?? 1;
    hud.setLocation(
      nivel === 4 ? "ALA C" : nivel === 3 ? "SÓTANO · EL ARCHIVO" : nivel === 2 ? "PLANTA 1 · ADMISIONES" : "PLANTA 2 · ALA B"
    );
    hud.startClock(3, 47);
    this.wirePauseMenu();

    this.engine.runRenderLoop(() => {
      scene.render();
      const dt = this.engine.getDeltaTime() / 1000;
      for (const f of this.onUpdate) f(dt);
      this.updateInteraction();
      const cam = this.player.camera;
      const nv = (this.state.get("nivel") as number) ?? 1;
      // cada planta exige su propio plano encontrado
      const mapaDe = nv === 4 ? "mapa4" : nv === 3 ? "mapa3" : nv === 2 ? "mapa2" : "mapa";
      minimap.update(nv, cam.position.x, cam.position.z, cam.rotation.y, this.playing && this.state.has(mapaDe));
    });
    window.addEventListener("resize", () => this.engine.resize());
    this.wireInput();
    this.wireAutoSave();

    if (!save) {
      await this.intro();
    } else {
      hud.show();
      await hud.fade(false, 1600);
    }
    hud.show();
    this.playing = true;
    this.player.setControl(true);
    this.checkPause();
  }

  // ------------------------------------------------------------ interacción

  register(
    meshes: AbstractMesh | AbstractMesh[],
    id: string,
    label: string | (() => string),
    action: () => void,
    enabled?: () => boolean
  ) {
    this.interactables.set(id, {
      label: typeof label === "string" ? () => label : label,
      action,
      enabled,
    });
    const arr = Array.isArray(meshes) ? meshes : [meshes];
    for (const m of arr) {
      m.metadata = { ...(m.metadata ?? {}), interactId: id };
      m.isPickable = true;
    }
  }

  unregister(id: string) {
    this.interactables.delete(id);
  }

  private updateInteraction() {
    if (!this.playing || this.uiBlocked()) {
      hud.prompt(null);
      this.currentTarget = null;
      return;
    }
    const ray = this.player.camera.getForwardRay(3.4);
    const hit = this.scene.pickWithRay(
      ray,
      (m) => m.isEnabled() && (!!m.metadata?.interactId || m.checkCollisions)
    );
    let target: Interactable | null = null;
    const id = hit?.pickedMesh?.metadata?.interactId;
    if (id) target = this.interactables.get(id) ?? null;
    if (target && target.enabled && !target.enabled()) target = null;
    this.currentTarget = target;
    hud.prompt(target ? target.label() : null);
  }

  uiBlocked() {
    return (
      this.dialogue.isOpen || this.keypad.isOpen || this.inventory.isOpen || this.journal.isOpen || this.modal || this.ended
    );
  }

  talk(tree: DTree, start: string) {
    this.player.setControl(false);
    this.dialogue.open(tree, start, () => {
      if (!this.ended) this.player.setControl(true);
    });
  }

  openKeypad(code: string, onOk: () => void) {
    this.player.setControl(false);
    this.keypad.open(code, onOk, () => {
      if (!this.ended) this.player.setControl(true);
      this.checkPause();
    });
  }

  setObjective(t: string) {
    this.state.objective = t;
    hud.objective(t);
  }

  notify(t: string, ms = 3200) {
    hud.notify(t, ms);
  }

  // ------------------------------------------------------------ input global

  private wireInput() {
    document.addEventListener("keydown", (e) => {
      if (!this.playing) return;
      if (this.keypad.isOpen) {
        this.keypad.key(e);
        e.preventDefault();
        return;
      }
      if (e.code === "KeyE" || e.code === "Enter") {
        if (this.dialogue.isOpen) {
          this.dialogue.advance();
          return;
        }
        if (this.inventory.isOpen) {
          if (this.inventory.examining) this.inventory.closeExamine();
          else this.inventory.examineSelected();
          return;
        }
        if (this.journal.isOpen) {
          this.journal.close();
          this.syncControl();
          return;
        }
        this.currentTarget?.action();
        return;
      }
      if (this.dialogue.isOpen) {
        const m = e.code.match(/^Digit(\d)$/);
        if (m) this.dialogue.choose(parseInt(m[1], 10) - 1);
        return;
      }
      if (this.inventory.isOpen) {
        if (e.code === "ArrowLeft" || e.code === "KeyA") this.inventory.move(-1);
        else if (e.code === "ArrowRight" || e.code === "KeyD") this.inventory.move(1);
        else if (e.code === "ArrowUp" || e.code === "KeyW") this.inventory.moveRow(-1);
        else if (e.code === "ArrowDown" || e.code === "KeyS") this.inventory.moveRow(1);
        else if (e.code === "Tab" || e.code === "KeyI") {
          e.preventDefault();
          this.inventory.close();
          this.syncControl();
          this.tryLock();
        }
        return;
      }
      if (this.journal.isOpen) {
        if (e.code === "KeyY" || e.code === "Tab" || e.code === "KeyI") {
          e.preventDefault();
          this.journal.close();
          this.syncControl();
        }
        return;
      }
      if (e.code === "Tab" || e.code === "KeyI") {
        e.preventDefault();
        this.inventory.toggle(this.state);
        this.syncControl();
        // el inventario se maneja con el ratón: soltamos el puntero
        if (this.inventory.isOpen) document.exitPointerLock?.();
        else this.tryLock();
        return;
      }
      if (e.code === "KeyY") {
        this.journal.toggle(this.state);
        this.syncControl();
        return;
      }
      if (e.code === "KeyQ" && !this.inventory.isOpen && !this.modal) {
        if (!this.state.has("linterna")) {
          this.notify("No llevas ninguna linterna.");
          return;
        }
        this.player.toggleFlashlight();
        this.sfx.switchClick();
        hud.torch(this.player.flashOn);
      }
    });

    window.addEventListener("click", (ev) => {
      const t = ev.target as HTMLElement | null;
      if (t && typeof t.closest === "function" && t.closest(".panel")) return;
      if (this.playing && !this.ended && !this.keypad.isOpen && !this.inventory.isOpen && !this.modal) this.tryLock();
    });

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.canvas) this.lockEverWorked = true;
      this.checkPause();
    });
    document.addEventListener("pointerlockerror", () => this.onLockError());
  }

  tryLock() {
    if (this.lockFallback) {
      this.checkPause();
      return;
    }
    if (document.pointerLockElement !== this.canvas) {
      try {
        const p = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
        if (p && typeof p.catch === "function") p.catch(() => this.onLockError());
      } catch {
        this.onLockError();
      }
    }
    this.checkPause();
  }

  private onLockError() {
    // Si alguna vez funcionó, es un fallo transitorio (p. ej. tras pulsar ESC,
    // el navegador impone un tiempo de espera): otro clic lo resolverá.
    if (this.lockEverWorked || this.lockFallback) {
      this.checkPause();
      return;
    }
    // Captura de puntero no disponible (p. ej. vista embebida): modo arrastre.
    this.lockFallback = true;
    this.player.dragLook = true;
    this.checkPause();
    this.notify("Tu navegador no permite capturar el ratón: mantén pulsado el clic y arrastra para mirar.", 6000);
  }

  checkPause() {
    const locked = document.pointerLockElement === this.canvas;
    const showPaused =
      this.playing &&
      !this.ended &&
      !locked &&
      !this.keypad.isOpen &&
      !this.inventory.isOpen &&
      !this.journal.isOpen &&
      !this.modal &&
      !this.lockFallback;
    const el = $("paused");
    const hint = $("start-hint");
    // en frío (nunca se llegó a capturar el puntero) no hay menú de pausa:
    // solo un aviso discreto para hacer clic
    if (showPaused && !this.lockEverWorked) {
      el.classList.add("hidden");
      hint.classList.remove("hidden");
      return;
    }
    hint.classList.add("hidden");
    const wasHidden = el.classList.contains("hidden");
    el.classList.toggle("hidden", !showPaused);
    if (showPaused && wasHidden) {
      $("pause-options").classList.add("hidden");
      $("pause-main").classList.remove("hidden");
    }
  }

  /** Control del jugador y visibilidad del HUD según qué paneles hay abiertos. */
  syncControl() {
    const uiOpen = this.inventory.isOpen || this.journal.isOpen;
    this.player.setControl(
      this.playing && !this.ended && !uiOpen && !this.dialogue.isOpen && !this.keypad.isOpen
    );
    if (this.playing && !this.ended) {
      if (uiOpen) hud.hide();
      else hud.show();
    }
    this.checkPause();
  }

  // ------------------------------------------------------------ menú de pausa

  private loadOpts() {
    try {
      return {
        vol: 80,
        sens: 50,
        crt: true,
        grain: true,
        ...(JSON.parse(localStorage.getItem("ftsj_opts") || "{}") as object),
      } as { vol: number; sens: number; crt: boolean; grain: boolean };
    } catch {
      return { vol: 80, sens: 50, crt: true, grain: true };
    }
  }

  private applyOpts(o: { vol: number; sens: number; crt: boolean; grain: boolean }) {
    this.sfx.setVolume(o.vol / 100);
    this.player?.setSensitivity(0.5 + o.sens / 100);
    $("scanlines").classList.toggle("hidden", !o.crt);
    $("grain").classList.toggle("hidden", !o.grain);
  }

  private wirePauseMenu() {
    const opts = this.loadOpts();
    const save = () => localStorage.setItem("ftsj_opts", JSON.stringify(opts));
    this.applyOpts(opts);

    const vol = $("opt-vol") as HTMLInputElement;
    const sens = $("opt-sens") as HTMLInputElement;
    vol.value = String(opts.vol);
    sens.value = String(opts.sens);
    $("opt-vol-val").textContent = String(opts.vol);
    $("opt-sens-val").textContent = String(opts.sens);
    $("opt-crt").classList.toggle("active", opts.crt);
    $("opt-grain").classList.toggle("active", opts.grain);

    vol.oninput = () => {
      opts.vol = +vol.value;
      $("opt-vol-val").textContent = vol.value;
      this.applyOpts(opts);
      save();
    };
    sens.oninput = () => {
      opts.sens = +sens.value;
      $("opt-sens-val").textContent = sens.value;
      this.applyOpts(opts);
      save();
    };
    $("opt-crt").onclick = () => {
      opts.crt = !opts.crt;
      $("opt-crt").classList.toggle("active", opts.crt);
      this.applyOpts(opts);
      save();
    };
    $("opt-grain").onclick = () => {
      opts.grain = !opts.grain;
      $("opt-grain").classList.toggle("active", opts.grain);
      this.applyOpts(opts);
      save();
    };
    $("btn-resume").onclick = () => this.tryLock();
    $("btn-options").onclick = () => {
      $("pause-main").classList.add("hidden");
      $("pause-options").classList.remove("hidden");
    };
    $("btn-opts-back").onclick = () => {
      $("pause-options").classList.add("hidden");
      $("pause-main").classList.remove("hidden");
    };
  }

  // ------------------------------------------------------------ secuencias

  /** Pantalla negra con líneas de texto (saltables con E/espacio). */
  async interlude(lines: string[]) {
    const el = $("intro");
    el.classList.remove("hidden");
    for (const l of lines) {
      el.textContent = l;
      el.style.opacity = "0";
      el.style.transition = "opacity 0.7s";
      await this.waitSkippable(300, () => (el.style.opacity = "1"));
      await this.waitSkippable(2300);
    }
    el.classList.add("hidden");
  }

  private async intro() {
    hud.fadeInstant(false);
    await this.interlude([
      "SANATORIO SAN JOSÉ",
      "PLANTA 2 · HABITACIÓN 104",
      "3:47 AM",
      "MARIO MATAS (PACIENTE Nº 0034).\nINGRESO INVOLUNTARIO. DÍA 217.",
      "El Director Rovira no sube a esta planta.\nEso dicen.",
      "Esta noche, alguien ha abierto\nla puerta de tu habitación.",
    ]);
    hud.fadeInstant(true);
    await hud.fade(false, 2000);
  }

  private waitSkippable(ms: number, onStart?: () => void): Promise<void> {
    return new Promise((resolve) => {
      onStart?.();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey);
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === "KeyE" || e.code === "Space" || e.code === "Enter") finish();
      };
      document.addEventListener("keydown", onKey);
      setTimeout(finish, ms);
    });
  }

  async endLevel(text: string) {
    if (this.ended) return;
    this.ended = true;
    this.playing = false;
    this.player.setControl(false);
    document.exitPointerLock?.();
    $("paused").classList.add("hidden");
    await hud.fade(true, 2400);
    hud.hide();
    $("ending-text").textContent = text;
    $("ending").classList.remove("hidden");
    ($("btn-ending-menu") as HTMLButtonElement).onclick = () => location.reload();
  }

  savePlayer() {
    const c = this.player.camera;
    this.state.save({
      x: c.position.x,
      y: c.position.y,
      z: c.position.z,
      ry: c.rotation.y,
    });
  }

  /** Autoguardado: silencioso, con un sello discreto en el HUD. */
  autoSave(motivo = "") {
    if (!this.playing || this.ended) return;
    this.savePlayer();
    hud.autoSaved(motivo);
  }

  /** Autoguardado periódico + al progresar (lo arranca start()). */
  private wireAutoSave() {
    let ultimo = performance.now();
    let flagsPrev = Object.keys(this.state.flags).length;
    let itemsPrev = this.state.items.length;
    this.onUpdate.push(() => {
      if (!this.playing || this.ended || this.modal || this.uiBlocked()) return;
      const ahora = performance.now();
      const flags = Object.keys(this.state.flags).length;
      const items = this.state.items.length;
      // al avanzar de verdad (nueva pista u objeto), sin esperar al reloj
      const progreso = flags !== flagsPrev || items !== itemsPrev;
      if (progreso && ahora - ultimo > 4000) {
        flagsPrev = flags;
        itemsPrev = items;
        ultimo = ahora;
        this.autoSave();
        return;
      }
      flagsPrev = flags;
      itemsPrev = items;
      if (ahora - ultimo > 90000) {
        ultimo = ahora;
        this.autoSave();
      }
    });
  }
}
