// vite.config.js
import path from "path";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, "src", "renderer"),
  base: "./", // ensures relative paths in production
  build: {
    outDir: path.join(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
  server: {
    port: 5173, // or any preferred port
  },
});
