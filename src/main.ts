import { Game } from "./game/Game";
import { GameState } from "./game/state";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const menu = document.getElementById("menu")!;
const btnNew = document.getElementById("btn-new") as HTMLButtonElement;
const btnCont = document.getElementById("btn-continue") as HTMLButtonElement;

if (GameState.hasSave()) btnCont.disabled = false;

let started = false;

async function launch(useSave: boolean, testNivel = 0) {
  if (started) return;
  started = true;
  menu.classList.add("hidden");
  // capturar el puntero YA, dentro del gesto del clic: así la intro
  // transcurre con el ratón capturado y no aparece pausa al empezar
  try {
    const p = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    /* sin captura: el juego activará su modo alternativo */
  }
  const game = new Game(canvas);
  (window as unknown as { game: Game }).game = game;
  game.sfx.init();
  await game.start(useSave ? GameState.load() : null, testNivel);
}

btnNew.addEventListener("click", () => {
  GameState.clearSave();
  launch(false);
});

btnCont.addEventListener("click", () => launch(true));

// selector de planta para probar pantallas sueltas sin rejugar
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>(".test-btn"))) {
  b.addEventListener("click", () => {
    GameState.clearSave();
    launch(false, Number(b.dataset.nivel) || 1);
  });
}

document.addEventListener("contextmenu", (e) => e.preventDefault());
