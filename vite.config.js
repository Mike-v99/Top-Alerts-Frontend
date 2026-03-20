// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to backend in dev
      "/alerts":  "http://localhost:3000",
      "/stripe":  "http://localhost:3000",
      "/health":  "http://localhost:3000",
    },
  },
});
