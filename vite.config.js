import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/live': { target: 'ws://localhost:3001', ws: true },
      '/api':  { target: 'http://localhost:3001' },
    },
  },
})
