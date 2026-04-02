import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  resolve: {
    alias: {
      // Point workspace dep directly at library source — no build step needed
      '@emstack/request': resolve(__dirname, '../../src/index.ts'),
    },
  },
});
