import { Hono } from 'hono';
import type { Env } from './env';
import type { DirectoryBrowser } from '../services/directory-browser';
import { handleRouteError } from './route-error';

export interface CreateFilesystemRoutesOptions {
  directoryBrowser: DirectoryBrowser;
}

export function createFilesystemRoutes(options: CreateFilesystemRoutesOptions): Hono<Env> {
  const routes = new Hono<Env>();
  routes.get('/directories', async (c) => {
    const showHidden = c.req.query('showHidden');
    if (showHidden !== undefined && showHidden !== 'true' && showHidden !== 'false') {
      return c.json({ error: 'showHidden must be true or false.' }, 400);
    }
    try {
      return c.json(
        await options.directoryBrowser.listDirectories(c.req.query('path'), {
          showHidden: showHidden === 'true',
        }),
      );
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });
  return routes;
}
