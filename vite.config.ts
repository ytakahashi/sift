import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import devServer from '@hono/vite-dev-server';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: 'src/server/dev-entry.ts',
      exclude: [/^(?!\/api).*/],
      injectClientScript: false,
    }),
  ],
  server: {
    port: 49321,
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
});
