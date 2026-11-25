import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    // Read the server's .env to get the correct port
    const serverEnv = loadEnv(mode, path.resolve(here, '../server'), '');
    const apiPort = Number(serverEnv.PORT) || 3001;

    return {
        plugins: [react()],
        server: {
            port: 5173,
            proxy: {
                // Changed to 'localhost' to fix Windows IPv6/IPv4 resolution issues
                '/api': {
                    target: `http://localhost:${apiPort}`,
                    changeOrigin: true,
                    secure: false,
                },
            },
            watch: {
                usePolling: process.env.VITE_POLLING === 'true',
                ignored: ['**/.vs/**', '**/node_modules/**', '**/.git/**', '**/dist/**'],
            },
        },
        build: {
            chunkSizeWarningLimit: 600,
        },
    };
});