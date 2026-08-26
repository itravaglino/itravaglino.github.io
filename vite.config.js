import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        cv: resolve(__dirname, "cv/index.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 43147,
  },
  preview: {
    host: "127.0.0.1",
    port: 43147,
  },
});
