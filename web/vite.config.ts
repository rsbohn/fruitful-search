import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: '/fruitful-search/',
  server: {
    port: 5173,
  },
});
