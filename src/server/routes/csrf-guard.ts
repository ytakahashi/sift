import type { MiddlewareHandler } from 'hono';
import type { Env } from './env';

const JSON_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const MUTATION_METHODS = new Set([...JSON_METHODS, 'DELETE']);

export function createCsrfGuard(): MiddlewareHandler<Env> {
  return async (c, next) => {
    if (!MUTATION_METHODS.has(c.req.method)) {
      await next();
      return;
    }

    // Modern browsers send Origin for methods other than GET/HEAD; allow it to
    // be absent for non-browser clients such as MCP and curl. A browser that
    // omits it still cannot send the JSON media type required below without a
    // CORS preflight, which this server never grants.
    const origin = c.req.header('origin');
    if (origin !== undefined) {
      const host = c.req.header('host');
      if (!host) {
        return c.json({ error: 'Forbidden: request origin does not match the server.' }, 403);
      }

      // Compare the full origin, including the port: other localhost ports are
      // separate browser origins even though the host guard permits them.
      // Host is used because c.req.url does not always reflect it (e.g. app.request).
      const targetUrl = new URL(c.req.url);
      targetUrl.host = host;
      if (origin !== targetUrl.origin) {
        return c.json({ error: 'Forbidden: request origin does not match the server.' }, 403);
      }
    }

    if (JSON_METHODS.has(c.req.method)) {
      // A browser can send text/plain or form data cross-origin without a CORS
      // preflight, so JSON endpoints must reject those media types before parsing.
      const mediaType = c.req.header('content-type')?.split(';', 1)[0].trim().toLowerCase();
      if (mediaType !== 'application/json') {
        return c.json({ error: 'Content-Type must be application/json.' }, 415);
      }
    }

    await next();
  };
}
