export const SAVE_KEY = "ftsj_save_v1";

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
}

export interface SaveData {
  flags: Record<string, unknown>;
  items: ItemDef[];
  pos: { x: number; y: number; z: number; ry: number };
  objective: string;
}

export class GameState {
  flags: Record<string, unknown> = {};
  items: ItemDef[] = [];
  objective = "";

  set(k: string, v: unknown = true) {
    this.flags[k] = v;
  }

  get(k: string) {
    return this.flags[k];
  }

  addItem(i: ItemDef) {
    if (!this.has(i.id)) this.items.push(i);
  }

  removeItem(id: string) {
    this.items = this.items.filter((x) => x.id !== id);
  }

  has(id: string) {
    return this.items.some((x) => x.id === id);
  }

  save(pos: { x: number; y: number; z: number; ry: number }) {
    const data: SaveData = {
      flags: this.flags,
      items: this.items,
      pos,
      objective: this.objective,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  restore(d: SaveData) {
    this.flags = d.flags ?? {};
    this.items = d.items ?? [];
    this.objective = d.objective ?? "";
  }

  static load(): SaveData | null {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      return s ? (JSON.parse(s) as SaveData) : null;
    } catch {
      return null;
    }
  }

  static hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  static clearSave() {
    localStorage.removeItem(SAVE_KEY);
  }
}
