import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { ServerType } from '@hono/node-server';
import { createApp, Env } from './create-app.js';
import { Hono } from 'hono';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRepoWatcher } from './watch/repo-watcher.js';
import { createWatchHub } from './watch/watch-hub.js';
import { createDefaultRepository } from './repositories/default-repository';

interface ServerRuntime {
  app: Hono<Env>;
  stop: () => Promise<void>;
}

const DEFAULT_PORT = 49321;
const MAX_PORT_SEARCH_ATTEMPTS = 100;

type ListenError = Error & { code?: string };

function isPortInUseError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const { code } = error as ListenError;
  return code === 'EADDRINUSE';
}

function listenOnPort(app: Hono<Env>, port: number): Promise<{ port: number; server: ServerType }> {
  return new Promise((resolve, reject) => {
    const server = createAdaptorServer({ fetch: app.fetch });

    const handleError = (error: Error) => {
      server.close();
      reject(error);
    };

    server.once('error', handleError);
    server.listen(port, () => {
      server.off('error', handleError);
      const address = server.address();

      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Server started without a TCP port'));
        return;
      }

      resolve({ port: address.port, server });
    });
  });
}

async function listenOnAvailablePort(
  app: Hono<Env>,
  preferredPort: number,
): Promise<{ port: number; server: ServerType }> {
  for (let offset = 0; offset < MAX_PORT_SEARCH_ATTEMPTS; offset += 1) {
    const port = preferredPort + offset;
    try {
      return await listenOnPort(app, port);
    } catch (error: unknown) {
      if (!isPortInUseError(error)) {
        throw error;
      }
    }
  }

  throw new Error(
    `No available port found between ${preferredPort} and ${
      preferredPort + MAX_PORT_SEARCH_ATTEMPTS - 1
    }`,
  );
}

function createServerRuntime(repoRoot: string): ServerRuntime {
  const repository = createDefaultRepository(repoRoot);
  const watchHub = createWatchHub();
  const watcher = createRepoWatcher(repository.path, () => {
    watchHub.broadcastChanged();
  });

  const app = new Hono<Env>();

  app.use('*', async (c, next) => {
    c.set('repository', repository);
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

  const portEnv = process.env.PORT;
  const port = portEnv ? parseInt(portEnv, 10) : DEFAULT_PORT;
  const listen = portEnv ? listenOnPort(cliApp, port) : listenOnAvailablePort(cliApp, port);
  const { port: actualPort, server } = await listen.catch(async (error: unknown) => {
    await runtime.stop();
    throw error;
  });

  const cleanup = () => {
    server.close();
    void runtime.stop();
  };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  return `http://localhost:${actualPort}`;
}
