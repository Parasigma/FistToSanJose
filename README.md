# FIRST TO SAN JOSE

## ▶ Jugar online

**https://parasigma.github.io/FistToSanJose/**

Funciona en cualquier navegador moderno de escritorio (Chrome, Edge, Firefox). No hay
nada que instalar: se abre el enlace y a jugar. La primera carga descarga ~6 MB.

Cada vez que se sube un cambio a `main`, GitHub Actions reconstruye el juego y
actualiza esa dirección automáticamente (ver `.github/workflows/deploy.yml`).


Survival horror en primera persona con estética retro noventera (estilo PSX), hecho con **Babylon.js + TypeScript + Vite**. Inspirado en el formato y estilo visual de los juegos episódicos de terror low-poly, pero con historia propia.

**Episodio 1 — Sanatorio San José.** Eres Mario Matas (Paciente Nº 0034), interno de ingreso involuntario. A las 3:47 AM alguien ha abierto la puerta de tu habitación y una nota firmada por "C.M." te empuja a bajar. Explora la planta 2, habla con los otros internos (Nikuman, el Chus, Montreal...) y con el celador Ortiz, resuelve los puzles y llega a la escalera.

El juego comparte universo con la aventura gráfica "Los Enfermos" (misma carpeta de Documentos): **toda la biblia narrativa adaptada está en [LORE.md](LORE.md)** — personajes, el misterio del Director Rovira, el giro maestro y las reglas de tono. Leerla antes de escribir nuevos diálogos o niveles.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

Para publicar los cambios en la web basta con subirlos:

```bash
git add -A && git commit -m "lo que sea" && git push
```

| Tecla | Acción |
| --- | --- |
| WASD / flechas | Moverse |
| Ratón | Mirar (clic para capturar el puntero) |
| E / Enter | Interactuar · avanzar diálogo |
| Q | Encender / apagar la linterna |
| 1–3 | Elegir opción de diálogo |
| TAB / I | Inventario |
| SHIFT | Correr |
| ESC | Soltar el ratón (pausa) |

**Guardar partida:** interactúa con el diario rojo del escritorio de tu habitación (104).

## Estructura del código

```
src/
├─ main.ts              → menú principal y arranque
├─ core/
│  ├─ psx.ts            → post-procesado PSX: baja resolución, dithering,
│  │                      cuantización de color, grano, viñeta, aberración cromática
│  ├─ player.ts         → controlador en primera persona (colisiones, head-bob, sprint)
│  ├─ textures.ts       → texturas procedurales sucias (sin assets externos)
│  └─ sfx.ts            → audio 100% procedural con WebAudio (ambiente, pasos, puertas…)
├─ ui/
│  ├─ hud.ts            → objetivo, prompts, notificaciones, fundidos
│  ├─ dialogue.ts       → diálogos con máquina de escribir y opciones
│  ├─ inventory.ts      → inventario
│  └─ keypad.ts         → teclado numérico para puertas con código
└─ game/
   ├─ Game.ts           → orquestador: input global, interacción por raycast, intro/final
   ├─ state.ts          → flags, inventario y guardado en localStorage
   ├─ npc.ts            → personajes low-poly procedurales (miran al jugador, respiran)
   └─ level1.ts         → la planta 2: mapa por tiles, puertas, luces, objetos,
                          PNJs, diálogos, puzles y objetivos
```

## Nivel 1 — contenido

- **Mapa por tiles**: 4 habitaciones, baños, pasillo, sala común, lavandería, enfermería y acceso a la escalera.
- **Personajes del universo "Los Enfermos"**: Ortiz (celador del turno de noche), Nikuman (descalzo, pullador, "brujo nº 1 del PoE"), el Chus (fugado de "tres manicomios, dos bodas y una mili"), Montreal (otaku sin prisa por escapar) y la voz de Paquito tras la puerta 102. Árboles de diálogo que cambian según tu progreso.
- **Cadena de puzles**: nota de C.M. → pista del Chus → recado de Nikuman (su radio, en la lavandería) → código de la enfermería (2413) → llave de la escalera → salida.
- **Semillas del lore** (ver [LORE.md](LORE.md)): la letra "familiar" de la nota, las firmas del Director que no coinciden, el canal 3 con el sillón vacío, la habitación 101, el Archivo y el ala C al bajar.
- **Extras**: TV con estática animada, luces que parpadean, espejo, expediente clínico, el yogur de piña prohibido (enséñaselo a Nikuman...), y objetos opcionales (destornillador, sedantes) para futuros niveles.

## Nivel 2 — Planta 1 (Archivo)

- Al abrir la escalera con la llave se baja a la **Planta 1**: cocina, despacho de Dirección, sala de terapia, almacén y el hall de Admisiones.
- **Puzle estilo Resident Evil**: el portón del Archivo tiene tres hornacinas («LA MERIENDA», «EL IMPERIO», «LA ÚLTIMA ESPERANZA»). Hay que colocar el **yogur de piña**, el **casco romano de Mario** y el **último pelo vivo de Victor** (en su cubo de metacrilato) para abrirlo.
- **Nikuman se aparece**: a intervalos aleatorios se materializa pegado a tu espalda o esperándote al doblar una esquina (siempre fuera de tu vista). Al verlo: punzada de susto. Se le puede hablar y suelta frases distintas cada vez. No hace nada… en esta planta.
- **Inventario 3D**: pulsa el número de un objeto en el inventario para examinarlo girando en 3D, estilo survival horror clásico.

## Añadir contenido

- Nuevos niveles: crea `level2.ts` siguiendo el patrón de `level1.ts` (mapa ASCII + `game.register(...)` para interacciones).
- Nuevos diálogos: son objetos `DTree` (nodos con `text`, `options`, `action`).
- El código de guardado ya serializa flags + inventario + posición; los objetos cogidos no reaparecen al cargar.
