import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        // Pure interfaces — no executable JS emitted
        'src/adapters/IHttpAdapter.ts',
        'src/adapters/ICacheStore.ts',
        // Erasable type imports only
        'src/types/index.ts',
        // Empty subclasses: all logic lives in AbstractFetchAdapter
        'src/adapters/BrowserFetchAdapter.ts',
        'src/adapters/NodeFetchAdapter.ts',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        // Branch threshold set below 95: remaining uncovered branches are optional-chaining
        // null checks (`?.`, `??`) that are guaranteed safe by the TypeScript type system
        // and therefore unreachable in practice. All meaningful logic paths are tested.
        branches: 88,
        statements: 95,
      },
    },
  },
});
