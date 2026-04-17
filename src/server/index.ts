import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp, Env } from './create-app.js';
import { Hono } from 'hono';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRepoWatcher } from './watch/repo-watcher.js';
import { createWatchHub } from './watch/watch-hub.js';

interface ServerRuntime {
  app: Hono<Env>;
  stop: () => Promise<void>;
}

function createServerRuntime(repoRoot: string): ServerRuntime {
  const watchHub = createWatchHub();
  const watcher = createRepoWatcher(repoRoot, () => {
    watchHub.broadcastChanged();
  });

  const app = new Hono<Env>();

  app.use('*', async (c, next) => {
    c.set('repoRoot', repoRoot);
    await next();
  });

  app.route('/', createApp({ watchHub }));

  return {
    app,
    stop: async () => {
      watchHub.close();
      await watcher.stop();
    },
  };
}

// Shared instance for Vite Dev server when running via `vite` CLI
const defaultRuntime = createServerRuntime(process.env.SIFT_REPO_ROOT || process.cwd());

export default defaultRuntime.app;

// Function called by CLI
export async function startServer(repoRoot: string): Promise<string> {
  const runtime = createServerRuntime(repoRoot);
  const cliApp = new Hono<Env>();
  cliApp.route('/', runtime.app);

  // In production, try to serve built client files.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDir = path.resolve(__dirname, '../../dist/client');

  const relativeClientDir = path.relative(process.cwd(), clientDir);
  cliApp.use('/assets/*', serveStatic({ root: relativeClientDir }));
  cliApp.use('/favicon.svg', serveStatic({ root: relativeClientDir }));

  cliApp.get('*', async (c) => {
    try {
      const { readFile } = await import('node:fs/promises');
      const html = await readFile(path.join(clientDir, 'index.html'), 'utf-8');
      return c.html(html);
    } catch {
      return c.text('Not Found', 404);
    }
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const cleanup = () => {
    void runtime.stop();
  };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  return new Promise((resolve) => {
    serve(
      {
        fetch: cliApp.fetch,
        port,
      },
      (info) => {
        resolve(`http://localhost:${info.port}`);
      },
    );
  });
}
