import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Config propia para que Vite no herede el postcss.config.js de carpetas padre
  css: { postcss: { plugins: [] } },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
});
