import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_TARGET = "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/health": { target: SERVER_TARGET, changeOrigin: true },
      "/api": { target: SERVER_TARGET, changeOrigin: true },
      "/ws": { target: SERVER_TARGET, ws: true },
    },
  },
});
