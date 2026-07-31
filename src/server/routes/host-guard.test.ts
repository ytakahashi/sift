import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { Env } from './env';
import { createHostGuard, isAllowedHost } from './host-guard';

describe('isAllowedHost', () => {
  it.each([
    ['localhost', true],
    ['LOCALHOST', true],
    ['localhost:49321', true],
    ['127.0.0.1', true],
    ['127.0.0.1:5173', true],
    ['[::1]', true],
    ['[::1]:49321', true],
    ['attacker.example', false],
    ['attacker.example:49321', false],
    // DNS rebinding domains that embed a local-looking prefix
    ['localhost.attacker.example', false],
    ['127.0.0.1.attacker.example', false],
    ['', false],
    [undefined, false],
  ] as Array<[string | undefined, boolean]>)('returns %s -> %s', (hostHeader, expected) => {
    // Given / When / Then: the header is judged purely by its hostname part
    expect(isAllowedHost(hostHeader)).toBe(expected);
  });
});

describe('createHostGuard', () => {
  function createApp(): Hono<Env> {
    const app = new Hono<Env>();
    app.use('*', createHostGuard());
    app.get('/ok', (c) => c.text('reached'));
    return app;
  }

  it('rejects requests with a non-local Host header', async () => {
    // Given: an app protected by the host guard
    const app = createApp();

    // When: a request arrives with a foreign Host header (DNS rebinding)
    const response = await app.request('/ok', { headers: { host: 'attacker.example:49321' } });

    // Then: the request is rejected before reaching the handler
    expect(response.status).toBe(403);
  });

  it('passes local requests through to the handler', async () => {
    // Given: an app protected by the host guard
    const app = createApp();

    // When: a request arrives from localhost
    const response = await app.request('/ok', { headers: { host: 'localhost:49321' } });

    // Then: the handler responds normally
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('reached');
  });
});
