import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/docs/openapi.yaml': 'http://localhost:8085',
      '/docs/openapi.json': 'http://localhost:8085',
      '/openapi.yaml': 'http://localhost:8085',
      '/openapi.json': 'http://localhost:8085',
      '/health': 'http://localhost:8085',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
