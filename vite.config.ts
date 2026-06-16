import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// 前端在 web/，开发期把 /api 与 /media-backup 代理到 Fastify 新后端(4174)。
export default defineConfig({
  root: "web",
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4174", changeOrigin: true },
      "/media-backup": { target: "http://localhost:4174", changeOrigin: true },
      "/uploads": { target: "http://localhost:4174", changeOrigin: true },
    },
  },
  build: { outDir: "../dist-web", emptyOutDir: true },
});
