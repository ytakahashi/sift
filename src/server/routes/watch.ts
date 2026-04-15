import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from '../create-app';
import type { WatchHub } from '../watch/watch-hub';

export function createWatchRoutes(watchHub: WatchHub): Hono<Env> {
  const watchRoutes = new Hono<Env>();

  watchRoutes.get('/', (c) => {
    return streamSSE(c, async (stream) => {
      watchHub.subscribe(stream);
      await new Promise<void>((resolve) => {
        stream.onAbort(resolve);
      });
    });
  });

  return watchRoutes;
}
