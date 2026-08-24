// @ts-check
import { defineConfig } from "astro/config";

// Fully static output: Astro compiles to HTML/CSS/JS in dist/, which nginx serves as-is.
// Ideal for the Raspberry Pi (the browser runs the JS; the server only serves files).
export default defineConfig({
  build: {
    // Hashed assets go to /_astro/ -> they can be cached "forever" (see nginx.conf)
    assets: "_astro",
  },
});
