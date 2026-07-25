import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_PORT = Number(process.env["NOTES_PORT"] ?? "8787");
const SERVER_TARGET = `http://127.0.0.1:${SERVER_PORT}`;
const WEB_PORT = Number(process.env["WEB_PORT"] ?? "5173");

export default defineConfig({
  plugins: [react()],
  server: {
    port: WEB_PORT,
    proxy: {
      "/health": { target: SERVER_TARGET, changeOrigin: true },
      "/api": { target: SERVER_TARGET, changeOrigin: true },
      "/ws": { target: SERVER_TARGET, ws: true },
    },
  },
});
