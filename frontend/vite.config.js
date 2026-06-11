import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://65.1.11.185:8121",
      "/health": "http://65.1.11.185:8121",
    },
  },
});
