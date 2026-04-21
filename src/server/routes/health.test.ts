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
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      product: 'sift',
      version: '1.0.0',
    });
  });
});
