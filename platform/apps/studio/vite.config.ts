import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Gateway (:8090) authenticates and routes to metadata / publish / runtime.
const GATEWAY = "http://127.0.0.1:8090";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@goapps/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@goapps/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
      "@goapps/formula": path.resolve(__dirname, "../../packages/formula/src"),
      "@goapps/ui": path.resolve(__dirname, "../../packages/ui/src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Metadata + most /api/v1 traffic via gateway
      "/api": {
        target: GATEWAY,
        changeOrigin: true,
      },
      // Studio publish client uses /publish-api/api/v1 → gateway /api/v1
      "/publish-api": {
        target: GATEWAY,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/publish-api/, ""),
      },
      // Studio records client uses /runtime-api/api → gateway /api
      "/runtime-api": {
        target: GATEWAY,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/runtime-api/, ""),
      },
      "/formula-api": {
        target: "http://127.0.0.1:8091",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/formula-api/, ""),
      },
    },
  },
  define: {
    "import.meta.env.VITE_FORMULA_API_URL": JSON.stringify("/formula-api"),
  },
});
