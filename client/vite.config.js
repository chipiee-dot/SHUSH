import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

// In development the React app runs on :5173 and forwards /api calls to the Node server,
// so the browser only ever talks to one origin (cookies just work).
export default defineConfig(({ mode }) => {
  // Use the PORT from server/.env, so a teammate who changed it does not have to change this file too.
  const serverEnv = loadEnv(mode, path.resolve(here, '../server'), '');
  const apiPort = Number(serverEnv.PORT) || 3001;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // 127.0.0.1, not "localhost": on some Windows setups "localhost" resolves to IPv6 first and the proxy fails.
        '/api': `http://127.0.0.1:${apiPort}`,
      },
      watch: {
        // File polling keeps the CPU busy all the time. It is only needed for network drives or some WSL/OneDrive
        // folders. If hot reload does not notice your edits, start with:  set VITE_POLLING=true  (then npm run dev)
        usePolling: process.env.VITE_POLLING === 'true',
        ignored: ['**/.vs/**', '**/node_modules/**', '**/.git/**', '**/dist/**'],
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
    },
  };
});
