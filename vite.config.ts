import { defineConfig } from "vite";

// El juego se sirve desde https://<usuario>.github.io/FistToSanJose/,
// así que las rutas de los assets tienen que colgar de ese subdirectorio.
export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/FistToSanJose/" : "/",
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 4000,
  },
});
