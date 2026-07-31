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
          setupFiles: ['src/client/vitest-setup.ts'],
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
          // Tests that do real I/O, such as spawning a real child process,
          // need a longer budget than the rest of the suite; isolating them
          // here keeps that budget off everything else.
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 10000,
        },
      },
    ],
  },
});
