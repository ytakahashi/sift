import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { ServerType } from '@hono/node-server';
import { createApp, Env } from './create-app.js';
import { Hono } from 'hono';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRepoWatchManager } from './watch/repo-watch-manager';
import { RepositoryConfigWatcher } from './infrastructure/config/repository-config-watcher';
import { buildLocalServerUrl, checkExistingSiftServer, DEFAULT_PORT } from './fixed-port';

interface ServerRuntime {
  app: Hono<Env>;
  stop: () => Promise<void>;
}

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

function createServerRuntime(): ServerRuntime {
  const repoWatchManager = createRepoWatchManager();
  const configWatcher = new RepositoryConfigWatcher();
  const app = new Hono<Env>();

  app.route(
    '/',
    createApp({
      repoWatchManager,
      readConfig: () => configWatcher.readConfig(),
    }),
  );

  return {
    app,
    stop: async () => {
      await repoWatchManager.close();
      await configWatcher.stop();
    },
  };
}

// Shared instance for Vite Dev server when running via `vite` CLI
const defaultRuntime = createServerRuntime();

export default defaultRuntime.app;

// Function called by CLI
export async function startServer(): Promise<string> {
  const runtime = createServerRuntime();
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
  const { server } = await listenOnPort(cliApp, port).catch(async (error: unknown) => {
    await runtime.stop();
    if (isPortInUseError(error)) {
      const existingServerStatus = await checkExistingSiftServer(port);
      if (existingServerStatus === 'sift') {
        return { port, server: null };
      }

      if (existingServerStatus === 'other') {
        throw new Error(`Port ${port} is already in use by another process.`);
      }
    }

    throw error;
  });

  if (!server) {
    return buildLocalServerUrl(port);
  }

  const cleanup = () => {
    server.close();
    void runtime.stop();
  };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  return buildLocalServerUrl(port);
}
