// vite.config.js
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, "src", "renderer"),
  base: "./", // ensures relative paths in production
  build: {
    outDir: path.join(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173, // or any preferred port
  },
});
