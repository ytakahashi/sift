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
          exclude: ['src/client/**'],
        },
      },
    ],
  },
});
