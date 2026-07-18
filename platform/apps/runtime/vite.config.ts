import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const GATEWAY = "http://localhost:8090";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@goapps/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@goapps/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
      "@goapps/formula": path.resolve(__dirname, "../../packages/formula/src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: GATEWAY,
        changeOrigin: true,
      },
      "/runtime-api": {
        target: GATEWAY,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/runtime-api/, ""),
      },
      "/formula-api": {
        target: "http://localhost:8091",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/formula-api/, ""),
      },
    },
  },
  define: {
    "import.meta.env.VITE_FORMULA_API_URL": JSON.stringify("/formula-api"),
  },
});
