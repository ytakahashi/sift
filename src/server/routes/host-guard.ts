import type { MiddlewareHandler } from 'hono';
import type { Env } from './env';

const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Whether the Host header names the local machine.
 *
 * The server only binds to 127.0.0.1, but that does not stop DNS rebinding:
 * a malicious page can point its own domain at 127.0.0.1 and issue requests
 * that reach this server with a foreign Host header. Rejecting non-local
 * hosts closes that path for every API and SSE route.
 */
export function isAllowedHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) {
    return false;
  }

  // Split off the port. IPv6 hosts keep their brackets ("[::1]:49321").
  const host = hostHeader.startsWith('[')
    ? hostHeader.replace(/(]):\d+$/, '$1')
    : hostHeader.replace(/:\d+$/, '');

  return ALLOWED_HOSTNAMES.has(host.toLowerCase());
}

export function createHostGuard(): MiddlewareHandler<Env> {
  return async (c, next) => {
    if (!isAllowedHost(c.req.header('host'))) {
      return c.json({ error: 'Forbidden: requests must originate from localhost.' }, 403);
    }
    await next();
  };
}
