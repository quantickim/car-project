import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { historyMiddleware } from './server/historyStore';

export default defineConfig({
  // GitHub Pages 는 https://<user>.github.io/<repo>/ 아래에서 서빙된다
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    {
      name: 'price-history',
      configureServer(server) {
        server.middlewares.use('/api/history', historyMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api/history', historyMiddleware);
      },
    },
  ],
  server: { host: true, watch: { ignored: ['**/data/**', '**/public/data/**'] } },
  preview: { host: true },
});
