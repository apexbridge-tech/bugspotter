import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    server: {
      deps: {
        inline: ['rrweb', 'rrweb-snapshot', '@rrweb/types'],
      },
    },
  },
});
