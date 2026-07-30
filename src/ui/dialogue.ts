export interface DOption {
  label: string;
  next?: string;
  action?: () => void;
  condition?: () => boolean;
}

export interface DNode {
  speaker?: string;
  text: string | (() => string);
  next?: string;
  options?: DOption[];
  action?: () => void;
}

export type DTree = Record<string, DNode>;

const $ = (id: string) => document.getElementById(id)!;

export class Dialogue {
  isOpen = false;
  onBlip: (() => void) | null = null;
  /** Aviso de cambio de nodo: lo usa el documento que se lee en la mano. */
  onNode: ((speaker: string, text: string) => void) | null = null;

  private tree: DTree = {};
  private nodeId = "";
  private typing = false;
  private fullText = "";
  private charI = 0;
  private timer: number | undefined;
  private visibleOptions: DOption[] = [];
  private onClose: (() => void) | null = null;
  private lastSpeaker = "";

  open(tree: DTree, start: string, onClose?: () => void) {
    this.isOpen = true;
    this.tree = tree;
    this.onClose = onClose ?? null;
    this.lastSpeaker = "";
    $("dialogue").classList.remove("hidden");
    this.goto(start);
  }

  private goto(id: string) {
    const n = this.tree[id];
    if (!n) {
      this.close();
      return;
    }
    this.nodeId = id;
    n.action?.();
    if (n.speaker) this.lastSpeaker = n.speaker;
    $("d-speaker").textContent = this.lastSpeaker;
    $("d-options").innerHTML = "";
    $("d-hint").textContent = "";
    this.fullText = typeof n.text === "function" ? n.text() : n.text;
    this.onNode?.(this.lastSpeaker, this.fullText);
    this.charI = 0;
    this.typing = true;
    $("d-text").textContent = "";
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      this.charI++;
      $("d-text").textContent = this.fullText.slice(0, this.charI);
      if (this.charI % 3 === 0) this.onBlip?.();
      if (this.charI >= this.fullText.length) this.finishTyping();
    }, 20);
  }

  private finishTyping() {
    window.clearInterval(this.timer);
    this.typing = false;
    $("d-text").textContent = this.fullText;
    const n = this.tree[this.nodeId];
    this.visibleOptions = (n.options ?? []).filter((o) => !o.condition || o.condition());
    const box = $("d-options");
    box.innerHTML = "";
    if (this.visibleOptions.length) {
      this.visibleOptions.forEach((o, i) => {
        const div = document.createElement("div");
        div.className = "opt";
        div.textContent = `${i + 1}. ${o.label}`;
        div.onclick = () => this.choose(i);
        box.appendChild(div);
      });
      $("d-hint").textContent = "elige con 1-" + this.visibleOptions.length;
    } else {
      $("d-hint").textContent = n.next ? "[E] continuar" : "[E] cerrar";
    }
  }

  advance() {
    if (!this.isOpen) return;
    if (this.typing) {
      this.charI = this.fullText.length;
      this.finishTyping();
      return;
    }
    if (this.visibleOptions.length) return;
    const n = this.tree[this.nodeId];
    if (n.next) this.goto(n.next);
    else this.close();
  }

  choose(i: number) {
    if (!this.isOpen || this.typing) return;
    const o = this.visibleOptions[i];
    if (!o) return;
    o.action?.();
    if (o.next) this.goto(o.next);
    else this.close();
  }

  close() {
    window.clearInterval(this.timer);
    this.isOpen = false;
    this.visibleOptions = [];
    $("dialogue").classList.add("hidden");
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }
}
