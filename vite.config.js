import { defineConfig } from "vite";

// GitHub Pages serves a project site under /<repo-name>/. This repo is fambus/gaao, so the default is /gaao/.
// Forks with another repo name or a custom domain: set GAAO_BASE (for example "/" or "/my-repo/") when building.
export default defineConfig({
  base: process.env.GAAO_BASE || "/gaao/",
  build: { outDir: "dist", sourcemap: true },
  server: { port: 5173, strictPort: true },
  test: { include: ["tests/**/*.test.js"], environment: "node" },
});
