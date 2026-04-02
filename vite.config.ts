import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      tsconfigPath: './tsconfig.json',
      insertTypesEntry: true,
      outDir: 'dist',
      rollupTypes: true,
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 4001,
  },
  build: {
    copyPublicDir: false,
    sourcemap: false,
    minify: "oxc",
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '@emstack/request',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
});
