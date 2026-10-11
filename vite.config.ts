import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { historyMiddleware } from './server/historyStore';

// 엔카 API는 CORS를 허용하지 않으므로 개발 서버가 대신 호출한다
const encarProxy: Record<string, ProxyOptions> = {
  '/encar-api': {
    target: 'https://api.encar.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/encar-api/, ''),
    headers: {
      Referer: 'https://car.encar.com/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36',
    },
  },
};

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
  server: { host: true, proxy: encarProxy, watch: { ignored: ['**/data/**', '**/public/data/**'] } },
  preview: { host: true, proxy: encarProxy },
});
