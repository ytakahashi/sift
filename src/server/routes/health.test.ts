import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { Env } from './env';
import { createHealthRoutes } from './health';

describe('createHealthRoutes', () => {
  it('returns the Sift product marker and the injected version', async () => {
    // Given
    const app = new Hono<Env>();
    app.route('/api/health', createHealthRoutes({ version: '1.2.3' }));

    // When
    const response = await app.request('/api/health');

    // Then
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      product: 'sift',
      version: '1.2.3',
      capabilities: ['notes-v1'],
    });
  });
});
