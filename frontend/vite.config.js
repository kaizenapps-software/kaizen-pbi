import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:4002',
        changeOrigin: true
      },
      '/reports': {
        target: 'http://localhost:4002',
        changeOrigin: true
      }
    }
  }
})
