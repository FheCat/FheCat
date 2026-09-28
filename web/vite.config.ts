import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The pixel-art renderer is shared with the contracts (see /art).
    alias: { '@art': fileURLToPath(new URL('../art', import.meta.url)) },
  },
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2022' },
});
