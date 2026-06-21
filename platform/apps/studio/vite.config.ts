import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@goapps/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@goapps/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api calls to the metadata service — avoids CORS in development
      "/api": {
        target: "http://localhost:8082",
        changeOrigin: true,
      },
    },
  },
});
