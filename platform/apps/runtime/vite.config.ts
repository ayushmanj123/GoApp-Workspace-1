import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@goapps/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@goapps/sdk': path.resolve(__dirname, '../../packages/sdk/src'),
      '@goapps/formula': path.resolve(__dirname, '../../packages/formula/src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:8082",
        changeOrigin: true,
      },
      "/runtime-api": {
        target: "http://localhost:8083",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/runtime-api/, ""),
      },
      "/formula-api": {
        target: "http://localhost:8085",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/formula-api/, ""),
      },
    },
  },
  define: {
    "import.meta.env.VITE_FORMULA_API_URL": JSON.stringify("/formula-api"),
  },
});
