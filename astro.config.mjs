// @ts-check
import { defineConfig } from "astro/config";

// Salida 100% estática: Astro compila a HTML/CSS/JS en dist/, que nginx sirve tal cual.
// Ideal para la Raspberry Pi (el navegador ejecuta el JS; el servidor solo sirve ficheros).
export default defineConfig({
  build: {
    // Los assets con hash van a /_astro/ -> se pueden cachear "para siempre" (ver nginx.conf)
    assets: "_astro",
  },
});
