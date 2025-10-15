import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Workaround for undici "File is not defined" error in Node 18
    // https://github.com/nodejs/undici/issues/1650
    setupFiles: ['./tests/setup-file-polyfill.ts', './tests/integrations/setup.ts'],
  },
});
