import { GameState } from "../game/state";

const $ = (id: string) => document.getElementById(id)!;

interface Hito {
  visible: (s: GameState) => boolean;
  done: (s: GameState) => boolean;
  text: (s: GameState) => string;
}

/** Registro cronológico de la noche: se tacha lo conseguido y los datos
 *  clave (como el código de la enfermería) quedan siempre consultables. */
const HITOS: Hito[] = [
  {
    visible: () => true,
    done: (s) => !!s.get("salio_celda"),
    text: () => "Salir de la habitación 104. La puerta estaba abierta.",
  },
  {
    visible: (s) => s.has("linterna"),
    done: () => true,
    text: () => "Junto al diario, una linterna de celador. La pegatina: «B. — TURNO NOCHE». ¿Qué hacía en tu habitación?",
  },
  {
    visible: (s) => !!s.get("nota_leida"),
    done: () => true,
    text: () => "La nota de C.M.: «baja por la escalera antes de que suene la campana». La letra te resultaba extrañamente familiar.",
  },
  {
    visible: (s) => !!s.get("oyo_rovira"),
    done: () => true,
    text: () => "Según Bartolo, el Director Rovira no sube a la planta 2... aunque algunos dicen que nunca ha salido de ella.",
  },
  {
    visible: (s) => !!(s.get("ortiz_hint") || s.get("chus_hint") || s.get("vio_puerta")),
    done: (s) => s.get("nivel") === 2,
    text: () => "Llegar a la escalera: está cerrada con llave. La llave se guarda en la enfermería.",
  },
  {
    visible: (s) => !!s.get("radio_quest"),
    done: (s) => !!s.get("radio_dada"),
    text: () => "Recuperar la radio de Nikuman en la lavandería, a cambio de «números».",
  },
  {
    visible: (s) => !!s.get("codigo_sabido"),
    done: (s) => !!s.get("enf_open"),
    text: () => "CÓDIGO DE LA ENFERMERÍA: 2 · 4 · 1 · 3 — cortesía de Nikuman, que se lo vio marcar a Bartolo.",
  },
  {
    visible: (s) => !!s.get("enf_open"),
    done: (s) => s.has("llave_escalera") || s.get("nivel") === 2,
    text: () => "Coger la llave de la escalera dentro de la enfermería.",
  },
  {
    visible: (s) => !!s.get("ernesto_aviso") || !!s.get("edu_aviso"),
    done: () => true,
    text: () => "Montreal: la megafonía ha dicho tu nombre dos veces. «Baja antes de la tercera.»",
  },
  {
    visible: (s) => !!s.get("nikuman_encanado"),
    done: () => true,
    text: () => "Le enseñaste el yogur de piña a Nikuman. Se encanó. Mereció la pena.",
  },
  {
    visible: (s) => !!s.get("tv_despacho"),
    done: () => true,
    text: () => "En un canal muerto de la tele: el despacho del Director en blanco y negro. CAM 01. El gran sillón, vacío.",
  },
  {
    visible: (s) => !!s.get("tv_serna"),
    done: () => true,
    text: () => "En otro canal, un anuncio en bucle: «MUDANZAS SERNA — ¡nosotros no necesitamos grúa!». Alguien lanza un sofá a un quinto piso. A pulso.",
  },
  {
    visible: (s) => s.has("llave_escalera") || s.get("nivel") === 2,
    done: (s) => s.get("nivel") === 2,
    text: () => "Bajar por la escalera hasta la planta 1.",
  },
  {
    visible: (s) => s.get("nivel") === 2,
    done: (s) => !!s.get("archivo_abierto"),
    text: () => "El portón del Archivo no cede: tres hornacinas esperan sus ofrendas.",
  },
  {
    visible: (s) => s.get("nivel") === 2 && !!s.get("vio_altar"),
    done: (s) => !!s.get("of_yogur"),
    text: () => "Ofrenda «LA MERIENDA»: el yogur de piña.",
  },
  {
    visible: (s) => s.get("nivel") === 2 && !!s.get("vio_altar"),
    done: (s) => !!s.get("of_casco"),
    text: () => "Ofrenda «EL IMPERIO»: el casco romano de Mario (vitrina del despacho).",
  },
  {
    visible: (s) => !!s.get("vio_vitrina"),
    done: (s) => !!s.get("vitrina_rota"),
    text: () => "La vitrina del casco tiene el cristal intacto: hace falta una herramienta contundente.",
  },
  {
    visible: (s) => !!s.get("nota_cifrada"),
    done: (s) => !!s.get("armario_movido"),
    text: () =>
      "Nota cifrada del mostrador: «Tijeras. Ruido. Alfombra. Sopa. / Espejo. Luna. / Almohada. Reloj. Manta. Aguja. Radio. Insomnio. Olvido.» La primera letra de cada palabra está repasada con fuerza.",
  },
  {
    visible: (s) => !!s.get("armario_movido"),
    done: () => true,
    text: () => "El mensaje decía: TRAS EL ARMARIO. Había un hueco excavado detrás del armario de la sala de terapia.",
  },
  {
    visible: (s) => !!s.get("uv_vista"),
    done: (s) => s.has("martillo"),
    text: () => "Hay una equis pintada en el suelo del almacén: solo brilla a oscuras, dentro del círculo directo de la linterna.",
  },
  {
    visible: (s) => s.has("martillo"),
    done: (s) => !!s.get("vitrina_rota"),
    text: () => "Martillo recuperado bajo la baldosa de la equis (almacén).",
  },
  {
    visible: (s) => s.get("nivel") === 2 && !!s.get("vio_altar"),
    done: (s) => !!s.get("of_pelo"),
    text: () => "Ofrenda «LA ÚLTIMA ESPERANZA»: el último pelo vivo de Victor (sala de terapia).",
  },
  {
    visible: (s) => !!s.get("archivo_abierto"),
    done: (s) => s.get("nivel") === 3,
    text: () => "El portón está abierto. Entrar en el Archivo.",
  },
  {
    visible: (s) => s.has("mapa"),
    done: () => true,
    text: () => "El mapa de evacuación de la habitación 103. Montreal lo tenía «por deformación profesional». Solo cubre la planta 2: cada planta esconde su propio plano.",
  },
  {
    visible: (s) => s.has("mapa2"),
    done: () => true,
    text: () => "El plano de la planta 1, en el escritorio del Director. El almacén está rodeado con rotulador rojo.",
  },
  {
    visible: (s) => s.has("mapa3"),
    done: () => true,
    text: () => "El plano de consulta del Archivo, en el atril de la entrada. La sección S–Z está tachada.",
  },
  {
    visible: (s) => s.get("nivel") === 3,
    done: (s) => !!s.get("cm_visto"),
    text: () => "El Archivo del sótano: pasillos de estanterías con un expediente por cada persona que pisó San José. Encontrar el de C.M.",
  },
  {
    visible: (s) => !!s.get("exp_rovira"),
    done: () => true,
    text: () => "La caja de ROVIRA ARANDA, RAFAEL está precintada: «EL DIRECTOR NO SE ARCHIVA». Entonces... ¿por qué está en el archivo?",
  },
  {
    visible: (s) => !!s.get("cm_visto"),
    done: () => true,
    text: () => "La caja «C.M.» estaba vacía. Solo una nota: «Baja. Te espero en el ALA C.» Esa letra, otra vez.",
  },
  {
    visible: (s) => !!s.get("espejo_alac"),
    done: () => true,
    text: () => "En el espejo del ala C, a tu espalda, todas las camas estaban hechas. En un ala donde no duerme nadie.",
  },
  {
    visible: (s) => !!s.get("nota_pajarito"),
    done: () => true,
    text: () => "Una nota en mitad del Archivo, boca arriba y sin una arruga: «Continúa, pajarito. Aún debes descubrir la verdad que se esconde entre estas paredes.» Firmado: C.M.",
  },
  {
    visible: (s) => !!s.get("mario_motes"),
    done: () => true,
    text: () => "Tu propio expediente necesita una SALA ENTERA. El tomo de onomástica registra «Kuroi Te», «Anovaldo», «Desiderio», «Vandimilian»... y nadie recuerda quién los puso.",
  },
  {
    visible: (s) => !!s.get("mario_tomo_curso"),
    done: () => true,
    text: () => "En la sala anexa hay un tomo ABIERTO con la entrada de esta madrugada: «04:52 — El sujeto lee esto». La tinta brillaba. Y la letra era la misma que la de la nota de C.M.",
  },
  {
    visible: (s) => !!s.get("kevin_director"),
    done: () => true,
    text: () => "Kevin: al Archivo no baja «el Director»... pero fue él quien lo ingresó, y su caja está arriba, precintada.",
  },
  {
    visible: (s) => !!s.get("secretaria_vista"),
    done: (s) => !!s.get("secretaria_fuera"),
    text: () => "La secretaria del ALA C no deja pasar sin volante sellado. Algo tendrá que... distraerla.",
  },
  {
    visible: (s) => !!(s.get("niku_arch") || s.get("candado_visto")),
    done: (s) => !!s.get("exp_niku_abierto"),
    text: () => "El expediente de Nikuman (sección G–M) está cerrado con un candado gordo. Él jura que dentro hay una «prueba» suya.",
  },
  {
    visible: (s) => !!s.get("exp_niku_abierto"),
    done: (s) => !!s.get("yogur_dado"),
    text: () => "Dentro del expediente de Ismael: un yogur de piña caducado, etiquetado como PRUEBA.",
  },
  {
    visible: (s) => !!s.get("secretaria_fuera"),
    done: () => true,
    text: () => "Le devolviste a Nikuman su yogur. Se encanó DEL TODO. La admisión al ALA C quedó... despejada. A ti no te tocó ni un pelo.",
  },
  {
    visible: (s) => s.get("nivel") === 4,
    done: (s) => s.has("tarjeta_roja"),
    text: () => "El ala C está tomada por celadores de ronda. Los armarios y los huecos bajo las mesas son tus amigos; la linterna encendida, tu chivata.",
  },
  {
    visible: (s) => !!s.get("tablon_visto"),
    done: (s) => s.has("tarjeta_roja"),
    text: () => "El tablón: la TARJETA ROJA de la azotea la lleva GUZMÁN, que se escapa a fumar a la sala de máquinas en mitad de la ronda.",
  },
  {
    visible: (s) => s.has("tarjeta_roja"),
    done: () => true,
    text: () => "Le vaciaste el bolsillo a Guzmán mientras fumaba. Ni se giró. La tarjeta roja es tuya.",
  },
  {
    visible: (s) => !!s.get("rob_pinto"),
    done: () => true,
    text: () => "Botín de PINTO: siete fotos dedicadas de Nikuman, todas iguales. Nadie se las pidió.",
  },
  {
    visible: (s) => !!s.get("rob_sosa"),
    done: () => true,
    text: () => "Botín de SOSA: un CD quemado que pone «JUEGOS». Debajo: «no son virus, confía».",
  },
  {
    visible: (s) => !!s.get("rob_molina"),
    done: () => true,
    text: () => "Botín de MOLINA: los calzoncillos de Paquito, talla BESTIA. ¿Por qué los llevaba encima?",
  },
  {
    visible: (s) => !!s.get("nota_azotea"),
    done: () => true,
    text: () => "Circular interna: prohibido comentar «el ala que se ve desde la azotea». No existe. Dejad de dibujarla.",
  },
  {
    visible: (s) => s.has("mapa4"),
    done: () => true,
    text: () => "El plano del ala C, con las rondas tachadas y la azotea rodeada de interrogaciones.",
  },
];

export class JournalUI {
  isOpen = false;

  toggle(state: GameState) {
    if (this.isOpen) this.close();
    else this.open(state);
  }

  open(state: GameState) {
    this.isOpen = true;
    $("jr-obj").textContent = state.objective || "—";
    const list = $("jr-list");
    list.innerHTML = "";
    const visibles = HITOS.filter((h) => h.visible(state));
    for (const h of visibles) {
      const row = document.createElement("div");
      const done = h.done(state);
      row.className = "jr-row " + (done ? "done" : "pend");
      const mark = document.createElement("span");
      mark.className = "jr-mark";
      mark.textContent = done ? "✓" : "▸";
      const txt = document.createElement("span");
      txt.className = "jr-txt";
      txt.textContent = h.text(state);
      row.appendChild(mark);
      row.appendChild(txt);
      list.appendChild(row);
    }
    if (!visibles.length) {
      const row = document.createElement("div");
      row.className = "jr-row pend";
      row.textContent = "La noche acaba de empezar.";
      list.appendChild(row);
    }
    $("journal").classList.remove("hidden");
  }

  close() {
    this.isOpen = false;
    $("journal").classList.add("hidden");
  }
}
