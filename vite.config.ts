import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const root = path.resolve(__dirname);
  const env = loadEnv(mode, root, '');
  const proxyTarget = (env.VITE_DEV_API_PROXY_TARGET || '').trim().replace(/\/+$/, '');
  const proxy =
    proxyTarget.length > 0
      ? {
          '/api': { target: proxyTarget, changeOrigin: true, secure: false },
          '/uploads': { target: proxyTarget, changeOrigin: true, secure: false },
        }
      : undefined;

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy,
    },
    resolve: {
      alias: {
        '@': path.resolve(root, './src'),
      },
    },
  };
});
