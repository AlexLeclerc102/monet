import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000", // FastAPI backend address
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""), // Optional, rewrites the API path
      },
    },
  },
});