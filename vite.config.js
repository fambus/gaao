import { defineConfig } from "vite";

// Served by GitHub Pages at https://fambus.github.io/gaao/
export default defineConfig({
  base: "/gaao/",
  build: { outDir: "dist", sourcemap: true },
  server: { port: 5173, strictPort: true },
  test: { include: ["tests/**/*.test.js"], environment: "node" },
});
