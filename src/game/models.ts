import {
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
} from "@babylonjs/core";

/**
 * Modelos 3D de los objetos del inventario (vista de examinar estilo RE)
 * y de sus versiones expuestas en el mundo. Autoiluminados para que se
 * vean bien incluso a oscuras.
 */

function mat(scene: Scene, name: string, hex: string, opts?: { em?: number; alpha?: number }): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.emissiveColor = m.diffuseColor.scale(opts?.em ?? 0.5);
  m.specularColor = Color3.Black();
  if (opts?.alpha !== undefined) m.alpha = opts.alpha;
  m.maxSimultaneousLights = 10;
  return m;
}

export function buildItemModel(scene: Scene, id: string): TransformNode | null {
  const root = new TransformNode("exam_" + id + "_" + Math.floor(Math.random() * 1e6), scene);
  const B = (w: number, h: number, d: number, x: number, y: number, z: number, mt: StandardMaterial, ry = 0, rz = 0, rx = 0) => {
    const b = MeshBuilder.CreateBox("mB", { width: w, height: h, depth: d }, scene);
    b.position.set(x, y, z);
    b.rotation.set(rx, ry, rz);
    b.material = mt;
    b.isPickable = false;
    b.parent = root;
    return b;
  };
  const C = (dTop: number, dBottom: number, h: number, x: number, y: number, z: number, mt: StandardMaterial, rx = 0, rz = 0) => {
    const c = MeshBuilder.CreateCylinder("mC", { diameterTop: dTop, diameterBottom: dBottom, height: h, tessellation: 12 }, scene);
    c.position.set(x, y, z);
    c.rotation.set(rx, 0, rz);
    c.material = mt;
    c.isPickable = false;
    c.parent = root;
    return c;
  };

  switch (id) {
    case "yogur_caducado": {
      const cup = mat(scene, "yc_cup", "#c8c4b0");
      const band = mat(scene, "yc_band", "#a8963c");
      const lid = mat(scene, "yc_lid", "#7a8a4a", { em: 0.6 }); // tapa hinchada y verdosa
      const moho = mat(scene, "yc_moho", "#4a6a3a", { em: 0.4 });
      C(0.15, 0.11, 0.17, 0, 0, 0, cup);
      C(0.148, 0.135, 0.06, 0, -0.02, 0, band);
      const tapa = C(0.16, 0.16, 0.028, 0, 0.095, 0, lid);
      tapa.rotation.x = 0.06; // combada
      B(0.05, 0.02, 0.05, 0.04, 0.08, 0.03, moho);
      return root;
    }
    case "yogur_pina": {
      const cup = mat(scene, "yg_cup", "#e8e4d8");
      const band = mat(scene, "yg_band", "#e0b93c");
      const lid = mat(scene, "yg_lid", "#d8c25a", { em: 0.75 });
      const pina = mat(scene, "yg_pina", "#4a8a3a");
      C(0.15, 0.11, 0.17, 0, 0, 0, cup);
      C(0.148, 0.135, 0.06, 0, -0.02, 0, band);
      C(0.16, 0.16, 0.014, 0, 0.09, 0, lid);
      B(0.05, 0.05, 0.005, 0, -0.01, -0.072, pina);
      return root;
    }
    case "casco_romano": {
      const bronze = mat(scene, "cs_bronze", "#a8823c");
      const crest = mat(scene, "cs_crest", "#8a2a20");
      const dome = MeshBuilder.CreateSphere("cs_dome", { diameter: 0.3, segments: 10 }, scene);
      dome.scaling.y = 0.85;
      dome.position.y = 0.03;
      dome.material = bronze;
      dome.isPickable = false;
      dome.parent = root;
      C(0.34, 0.34, 0.03, 0, -0.06, 0, bronze); // ala
      B(0.09, 0.13, 0.02, -0.13, -0.11, 0.06, bronze, 0.25); // carrillera izda
      B(0.09, 0.13, 0.02, 0.13, -0.11, 0.06, bronze, -0.25); // carrillera dcha
      B(0.16, 0.03, 0.1, 0, -0.08, -0.16, bronze); // cubrenucas
      B(0.04, 0.05, 0.3, 0, 0.16, 0, bronze); // base del penacho
      B(0.035, 0.11, 0.26, 0, 0.24, 0, crest); // penacho
      return root;
    }
    case "cubo_pelo": {
      const glass = mat(scene, "cp_glass", "#9fb8c8", { alpha: 0.22, em: 0.35 });
      const base = mat(scene, "cp_base", "#26262a");
      const hair = mat(scene, "cp_hair", "#171310", { em: 0.3 });
      const plaque = mat(scene, "cp_plq", "#c2a044", { em: 0.6 });
      B(0.3, 0.05, 0.3, 0, -0.14, 0, base);
      B(0.24, 0.24, 0.24, 0, 0.0, 0, glass);
      const pelo = C(0.006, 0.006, 0.15, 0, 0.0, 0, hair, 0.35, 0.4);
      pelo.position.y = -0.01;
      B(0.14, 0.045, 0.008, 0, -0.135, -0.152, plaque);
      return root;
    }
    case "radio": {
      const body = mat(scene, "rd_body", "#6e4526");
      const dark = mat(scene, "rd_dark", "#1e1c1a");
      const knob = mat(scene, "rd_knob", "#c2a044", { em: 0.6 });
      const metal = mat(scene, "rd_metal", "#8a8f92");
      B(0.4, 0.2, 0.12, 0, 0, 0, body);
      B(0.16, 0.13, 0.01, -0.08, 0, -0.066, dark); // altavoz
      C(0.045, 0.045, 0.02, 0.1, 0.03, -0.06, knob, Math.PI / 2);
      C(0.045, 0.045, 0.02, 0.1, -0.05, -0.06, knob, Math.PI / 2);
      const ant = C(0.008, 0.008, 0.34, 0.16, 0.24, 0.02, metal, 0, 0.5);
      ant.isPickable = false;
      return root;
    }
    case "llave_escalera": {
      const gold = mat(scene, "lv_gold", "#c2a044", { em: 0.6 });
      C(0.02, 0.02, 0.16, 0, 0, 0, gold, 0, Math.PI / 2); // caña horizontal
      B(0.07, 0.075, 0.015, -0.11, 0, 0, gold); // cabeza
      B(0.03, 0.02, 0.015, 0.07, -0.03, 0, gold); // diente 1
      B(0.02, 0.03, 0.015, 0.045, -0.035, 0, gold); // diente 2
      const tag = mat(scene, "lv_tag", "#d6d0be", { em: 0.55 });
      B(0.08, 0.05, 0.006, -0.11, -0.07, 0, tag, 0, 0.2); // etiqueta de cartón
      return root;
    }
    case "destornillador": {
      const handle = mat(scene, "ds_handle", "#8a2a20");
      const steel = mat(scene, "ds_steel", "#9aa0a4", { em: 0.45 });
      C(0.05, 0.045, 0.1, 0, -0.07, 0, handle);
      C(0.013, 0.013, 0.15, 0, 0.05, 0, steel);
      B(0.03, 0.02, 0.006, 0, 0.13, 0, steel);
      return root;
    }
    case "sedantes": {
      const bottle = mat(scene, "sd_bottle", "#d8d4c8");
      const cap = mat(scene, "sd_cap", "#3a5a8a");
      const label = mat(scene, "sd_label", "#b8b2a0", { em: 0.6 });
      C(0.08, 0.08, 0.12, 0, 0, 0, bottle);
      C(0.055, 0.055, 0.035, 0, 0.078, 0, cap);
      B(0.06, 0.06, 0.002, 0, -0.005, -0.041, label);
      return root;
    }
    case "tarjeta_roja": {
      const card = mat(scene, "tj_card", "#a02a22", { em: 0.6 });
      const stripe = mat(scene, "tj_stripe", "#1a1a1c");
      const chip = mat(scene, "tj_chip", "#c2a044", { em: 0.7 });
      B(0.3, 0.008, 0.19, 0, 0, 0, card);
      B(0.3, 0.009, 0.045, 0, 0.001, -0.055, stripe);
      B(0.05, 0.01, 0.04, -0.09, 0.002, 0.03, chip);
      return root;
    }
    case "fotos_nikuman": {
      const paper = mat(scene, "fn_paper", "#d8d2be", { em: 0.6 });
      const tinta = mat(scene, "fn_tinta", "#3a4a3a");
      B(0.2, 0.012, 0.26, 0, 0, 0, paper);
      B(0.2, 0.012, 0.26, 0.02, 0.013, 0.015, paper, 0.12);
      B(0.12, 0.014, 0.15, 0.01, 0.022, 0.01, tinta, 0.12); // el retrato
      return root;
    }
    case "cd_juegos": {
      const disc = mat(scene, "cd_disc", "#b8c4cc", { em: 0.7 });
      const label = mat(scene, "cd_label", "#8a2a20", { em: 0.5 });
      C(0.24, 0.24, 0.01, 0, 0, 0, disc);
      C(0.09, 0.09, 0.012, 0, 0.002, 0, label);
      C(0.03, 0.03, 0.014, 0, 0.004, 0, mat(scene, "cd_hole", "#111"));
      return root;
    }
    case "calzones_paquito": {
      const tela = mat(scene, "cp_tela", "#b8b2a0");
      const goma = mat(scene, "cp_goma", "#8a8474");
      B(0.26, 0.07, 0.2, 0, 0, 0, tela, 0.1);
      B(0.27, 0.035, 0.21, 0, 0.045, 0, goma, 0.1);
      return root;
    }
    case "mapa":
    case "mapa2":
    case "mapa3":
    case "mapa4": {
      const paper = mat(scene, "mp_paper", "#d8d2be", { em: 0.6 });
      const ink = mat(scene, "mp_ink", "#8a2a20", { em: 0.5 });
      const fold = mat(scene, "mp_fold", "#b8b2a0");
      B(0.34, 0.008, 0.26, 0, 0, 0, paper);
      B(0.115, 0.009, 0.26, -0.113, 0.004, 0, fold, 0, 0.06); // pliegue izdo
      B(0.115, 0.009, 0.26, 0.113, 0.004, 0, fold, 0, -0.06); // pliegue dcho
      B(0.03, 0.01, 0.03, 0.06, 0.006, 0.05, ink); // "usted está aquí"
      B(0.12, 0.01, 0.008, -0.05, 0.006, -0.06, ink, 0.4); // ruta de fuga
      return root;
    }
    case "linterna": {
      const body = mat(scene, "ln_body", "#26282c");
      const metal = mat(scene, "ln_metal", "#3a3e44");
      const lens = mat(scene, "ln_lens", "#fff2c0", { em: 0.9 });
      const strap = mat(scene, "ln_strap", "#6b5a42");
      C(0.055, 0.055, 0.2, 0, 0, 0, body, 0, Math.PI / 2);
      C(0.06, 0.085, 0.07, -0.13, 0, 0, metal, 0, Math.PI / 2);
      C(0.07, 0.07, 0.012, -0.168, 0, 0, lens, 0, Math.PI / 2);
      B(0.02, 0.005, 0.09, 0.11, -0.03, 0, strap, 0, 0, 0.5);
      return root;
    }
    case "martillo": {
      const wood = mat(scene, "mt_wood", "#7a5c38");
      const steel = mat(scene, "mt_steel", "#8e9498", { em: 0.45 });
      C(0.045, 0.05, 0.26, 0, -0.05, 0, wood); // mango
      B(0.2, 0.075, 0.075, 0, 0.12, 0, steel); // cabeza
      B(0.05, 0.08, 0.06, 0.115, 0.12, 0, steel); // boca
      B(0.045, 0.055, 0.05, -0.11, 0.13, 0, steel, 0, 0.35); // uña
      return root;
    }
    case "expediente": {
      const folder = mat(scene, "xp_folder", "#b89a5e");
      const paper = mat(scene, "xp_paper", "#e0dccc", { em: 0.55 });
      const stamp = mat(scene, "xp_stamp", "#8a2a20", { em: 0.5 });
      B(0.28, 0.015, 0.36, 0, 0, 0, folder);
      B(0.25, 0.006, 0.33, 0.01, 0.012, 0.008, paper);
      B(0.06, 0.002, 0.03, 0.07, 0.017, -0.1, stamp, 0.3);
      return root;
    }
    default:
      root.dispose();
      return null;
  }
}
