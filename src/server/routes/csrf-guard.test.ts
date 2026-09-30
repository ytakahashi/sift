import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { createCsrfGuard } from './csrf-guard';

function createApp(): { app: Hono<Env>; reached: ReturnType<typeof vi.fn> } {
  const app = new Hono<Env>();
  const reached = vi.fn();
  app.use('*', createCsrfGuard());
  app.all('/action', (c) => {
    reached();
    return c.text('reached');
  });
  return { app, reached };
}

describe('createCsrfGuard', () => {
  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data'])(
    'rejects a %s request before it reaches a JSON action',
    async (contentType) => {
      // Given: the body contains valid JSON despite its browser-simple media type
      const { app, reached } = createApp();

      // When
      const response = await app.request('/action', {
        method: 'POST',
        headers: { host: '127.0.0.1:49321', 'Content-Type': contentType },
        body: '{}',
      });

      // Then
      expect(response.status).toBe(415);
      expect(reached).not.toHaveBeenCalled();
    },
  );

  it.each(['POST', 'PUT', 'PATCH'])('requires JSON media type for %s', async (method) => {
    // Given
    const { app, reached } = createApp();

    // When
    const response = await app.request('/action', { method, headers: { host: 'localhost' } });

    // Then
    expect(response.status).toBe(415);
    expect(reached).not.toHaveBeenCalled();
  });

  it.each([
    'http://attacker.example:49321',
    'http://127.0.0.1:5173',
    'http://localhost:49321',
    'https://127.0.0.1:49321',
    'null',
  ])('rejects a foreign Origin of %s', async (origin) => {
    // Given
    const { app, reached } = createApp();

    // When
    const response = await app.request('/action', {
      method: 'POST',
      headers: { host: '127.0.0.1:49321', Origin: origin, 'Content-Type': 'application/json' },
      body: '{}',
    });

    // Then
    expect(response.status).toBe(403);
    expect(reached).not.toHaveBeenCalled();
  });

  it('accepts same-origin JSON with a charset parameter', async () => {
    // Given
    const { app, reached } = createApp();

    // When
    const response = await app.request('/action', {
      method: 'PATCH',
      headers: {
        host: '127.0.0.1:49321',
        Origin: 'http://127.0.0.1:49321',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: '{}',
    });

    // Then
    expect(response.status).toBe(200);
    expect(reached).toHaveBeenCalledOnce();
  });

  it('accepts a JSON request with no Origin for non-browser clients', async () => {
    // Given
    const { app, reached } = createApp();

    // When
    const response = await app.request('/action', {
      method: 'POST',
      headers: { host: '127.0.0.1:49321', 'Content-Type': 'application/json' },
      body: '{}',
    });

    // Then
    expect(response.status).toBe(200);
    expect(reached).toHaveBeenCalledOnce();
  });

  it('allows bodyless DELETE without Origin but rejects a foreign Origin', async () => {
    // Given
    const { app, reached } = createApp();

    // When
    const localResponse = await app.request('/action', {
      method: 'DELETE',
      headers: { host: '127.0.0.1:49321' },
    });
    const foreignResponse = await app.request('/action', {
      method: 'DELETE',
      headers: { host: '127.0.0.1:49321', Origin: 'http://attacker.example' },
    });

    // Then
    expect(localResponse.status).toBe(200);
    expect(foreignResponse.status).toBe(403);
    expect(reached).toHaveBeenCalledOnce();
  });

  it('does not restrict GET requests', async () => {
    // Given
    const { app, reached } = createApp();

    // When
    const response = await app.request('/action', {
      headers: { host: '127.0.0.1:49321', Origin: 'http://attacker.example' },
    });

    // Then
    expect(response.status).toBe(200);
    expect(reached).toHaveBeenCalledOnce();
  });
});
