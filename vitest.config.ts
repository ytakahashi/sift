import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    projects: [
      {
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/client/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/client/**', 'src/**/*.integration.test.ts'],
        },
      },
      {
        test: {
          // For tests that can take longer than an in-process unit test,
          // such as spawning a real child process, so that budget doesn't
          // apply to the rest of the suite.
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 10000,
        },
      },
    ],
  },
});
