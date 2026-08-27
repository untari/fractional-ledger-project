import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    // Any request the app makes to a path starting with /api is forwarded to
    // the backend on port 3001. This means frontend code can just call
    // fetch('/api/aircraft/1') without knowing the backend's address, and there
    // are no cross-origin (CORS) issues during development.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
