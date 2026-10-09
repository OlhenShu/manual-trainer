import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api-unit',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    environment: 'node',
  },
});
