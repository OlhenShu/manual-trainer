import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api-integration',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    environment: 'node',
    env: {
      BCRYPT_ROUNDS: '4',
      REVIEW_PROVIDER: 'local',
    },
  },
});
