import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || 5173)
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:3000'
  const proxy = {
    '/api': { target, changeOrigin: true },
    '/socket.io': { target, changeOrigin: true, ws: true },
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { host: true, port, strictPort: true, proxy },
    preview: { host: true, port, strictPort: true, proxy },
  }
})
