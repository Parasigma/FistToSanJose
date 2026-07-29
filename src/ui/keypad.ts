import { Sfx } from "../core/sfx";

export class Keypad {
  isOpen = false;

  private entry = "";
  private code = "";
  private success = false;
  private onOk: (() => void) | null = null;
  private onDone: (() => void) | null = null;

  constructor(private sfx: Sfx) {}

  open(code: string, onOk: () => void, onDone?: () => void) {
    this.isOpen = true;
    this.code = code;
    this.entry = "";
    this.success = false;
    this.onOk = onOk;
    this.onDone = onDone ?? null;
    this.msg("");
    this.render();
    document.getElementById("keypad")!.classList.remove("hidden");
  }

  key(e: KeyboardEvent) {
    if (!this.isOpen || this.success) return;
    if (e.code === "KeyQ") {
      this.close();
      return;
    }
    if (e.code === "Backspace") {
      this.entry = this.entry.slice(0, -1);
      this.render();
      return;
    }
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      this.check();
      return;
    }
    const m = e.code.match(/^(?:Digit|Numpad)(\d)$/);
    if (m && this.entry.length < 4) {
      this.entry += m[1];
      this.sfx.keyBeep();
      this.render();
    }
  }

  private check() {
    if (this.entry.length < 4) return;
    if (this.entry === this.code) {
      this.success = true;
      this.sfx.unlock();
      this.msg("ACCESO CONCEDIDO", "#9fe89f");
      setTimeout(() => this.close(), 600);
    } else {
      this.sfx.error();
      this.msg("CÓDIGO INCORRECTO");
      this.entry = "";
      this.render();
    }
  }

  close() {
    this.isOpen = false;
    document.getElementById("keypad")!.classList.add("hidden");
    const ok = this.success ? this.onOk : null;
    const done = this.onDone;
    this.onOk = null;
    this.onDone = null;
    ok?.();
    done?.();
  }

  private render() {
    document.getElementById("kp-display")!.textContent =
      this.entry.padEnd(4, "_");
  }

  private msg(t: string, color = "#d66") {
    const el = document.getElementById("kp-msg")!;
    el.textContent = t;
    el.style.color = color;
  }
}
