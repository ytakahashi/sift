import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devServer from '@hono/vite-dev-server'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: 'src/server/index.ts',
      exclude: [
        /^(?!\/api).*/
      ],
      injectClientScript: false
    })
  ],
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  }
})
