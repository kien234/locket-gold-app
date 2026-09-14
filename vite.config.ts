import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// PORT cố định – luôn trùng với PORT=3009 trong .env
const BACKEND_PORT = 3009

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Đọc VITE_ALLOWED_HOSTS từ .env, phân cách bằng dấu phẩy
  const extraHosts = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map(h => h.trim())
    .filter(Boolean)

  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    ...extraHosts,
  ]

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5174,

      allowedHosts,

      watch: {
        ignored: [
          '**/ctv_orders_fallback.json',
          '**/orders_fallback.json',
          '**/.acb_token_cache.json',
          '**/active_port.json',
          '**/server/*.json',
          '**/lsgd/*.json',
        ],
      },

      proxy: {
        '/api/locket': {
          target: 'https://locket.cam',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/locket/, ''),
        },
        '/ws': {
          target: `ws://127.0.0.1:${BACKEND_PORT}`,
          ws: true,
          changeOrigin: true,
        },
        '/api': {
          target: `http://127.0.0.1:${BACKEND_PORT}`,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res: any) => {
              if (res && 'headersSent' in res && !res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ status: 'error', message: 'Backend server not responding' }))
              }
            })
            proxy.on('proxyRes', (proxyRes, req) => {
              if (req.url?.includes('/stream')) {
                proxyRes.headers['x-accel-buffering'] = 'no'
              }
            })
          },
        },
      },
    },
  }
})