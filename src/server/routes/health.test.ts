import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { healthRoutes } from './health';

describe('healthRoutes', () => {
  it('returns the Sift product marker', async () => {
    // Given
    const app = new Hono<Env>();
    app.route('/api/health', healthRoutes);

    // When
    const response = await app.request('/api/health');

    // Then
    // The version is sourced from package.json at runtime; assert the
    // semantic versioning shape rather than a literal value so the test
    // does not need updating on every release.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      product: 'sift',
      version: expect.stringMatching(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/),
      capabilities: ['notes-v1'],
    });
  });
});
