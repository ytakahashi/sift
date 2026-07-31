import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { ServerType } from '@hono/node-server';
import { createApp } from './create-app';
import type { Env } from './routes/env';
import { Hono } from 'hono';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRepoWatchManager } from './watch/repo-watch-manager';
import { createRepoWatcher } from './infrastructure/watch/repo-watcher-impl';
import { RepositoryConfigWatcher } from './infrastructure/config/repository-config-watcher';
import { createRepositoryConfigUpdater } from './infrastructure/config/repository-config-updater-impl';
import { validateRepositoryPath } from './infrastructure/repository-validator';
import { buildLocalServerUrl, LOOPBACK_HOST, resolvePort } from './fixed-port';
import { checkExistingSiftServer } from './health-probe';

export interface StartedServer {
  url: string;
  owned: boolean;
  stop: () => Promise<void>;
}

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

function listenOnPort(
  app: Hono<Env>,
  port: number,
  host = LOOPBACK_HOST,
): Promise<{ port: number; server: ServerType }> {
  return new Promise((resolve, reject) => {
    const server = createAdaptorServer({ fetch: app.fetch });

    const handleError = (error: Error): void => {
      server.close();
      reject(error);
    };

    server.once('error', handleError);
    server.listen(port, host, () => {
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
  // createRepoWatcher is passed explicitly; repo-watch-manager no longer imports infra directly.
  const repoWatchManager = createRepoWatchManager({ createWatcher: createRepoWatcher });
  const configWatcher = new RepositoryConfigWatcher();
  const validateRepository = validateRepositoryPath;
  const app = new Hono<Env>();

  app.route(
    '/',
    createApp({
      repoWatchManager,
      readConfig: () => configWatcher.readConfig(),
      validateRepository,
      repositoryConfigUpdater: createRepositoryConfigUpdater({
        invalidateConfig: () => configWatcher.invalidate(),
        validateRepository,
      }),
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

export { createRepositoryConfigUpdater } from './infrastructure/config/repository-config-updater-impl';
export { createRegisteredRepositoryLister } from './infrastructure/config/repository-config-lister-impl';
export type {
  RegisteredRepositoryLister,
  RepositoryConfigUpdater,
} from './services/repository-config';

function buildServerApp(runtime: ServerRuntime, clientDir: string): Hono<Env> {
  const serverApp = new Hono<Env>();
  serverApp.route('/', runtime.app);

  const relativeClientDir = path.relative(process.cwd(), clientDir);
  serverApp.use('/assets/*', serveStatic({ root: relativeClientDir }));
  serverApp.use('/favicon.svg', serveStatic({ root: relativeClientDir }));

  serverApp.get('*', async (c) => {
    try {
      const { readFile } = await import('node:fs/promises');
      const html = await readFile(path.join(clientDir, 'index.html'), 'utf-8');
      return c.html(html);
    } catch (_error: unknown) {
      return c.text('Not Found', 404);
    }
  });

  return serverApp;
}

export async function startServerWithHandle(options: {
  clientDir: string;
}): Promise<StartedServer> {
  const port = resolvePort();

  const runtime = createServerRuntime();
  const serverApp = buildServerApp(runtime, options.clientDir);

  const listenResult = await listenOnPort(serverApp, port).catch(async (error: unknown) => {
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

  const url = buildLocalServerUrl(port);

  if (!listenResult.server) {
    return { url, owned: false, stop: async () => {} };
  }

  const { server } = listenResult;
  return {
    url,
    owned: true,
    stop: async () => {
      server.close();
      await runtime.stop();
    },
  };
}

export interface StartServerResult {
  owned: boolean;
  url: string;
}

export async function startServer(): Promise<StartServerResult> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDir = path.resolve(__dirname, '../../dist/client');

  const { url, owned, stop } = await startServerWithHandle({ clientDir });

  if (owned) {
    const cleanup = (): void => {
      void stop();
    };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  return { owned, url };
}
