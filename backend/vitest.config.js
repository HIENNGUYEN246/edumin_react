import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    // A shared in-memory Mongo replica set can be slow to download the first run.
    testTimeout: 60000,
    hookTimeout: 120000,
    pool: 'forks',
    fileParallelism: false,
  },
});
