import type { Hono } from 'hono';
import { createApp } from './create-app';
import type { Env } from './routes/env';
import { createRepoWatchManager } from './watch/repo-watch-manager';
import { createRepoWatcher } from './infrastructure/watch/repo-watcher-impl';
import { RepositoryConfigWatcher } from './infrastructure/config/repository-config-watcher';
import { createRepositoryConfigUpdater } from './infrastructure/config/repository-config-updater-impl';
import { validateRepositoryPath } from './infrastructure/repository-validator';

export interface ServerRuntime {
  app: Hono<Env>;
  stop: () => Promise<void>;
}

/**
 * Builds the API app together with the long-lived resources it depends on.
 * Creating a runtime starts those resources, so the caller owns it and must
 * call `stop` when the server goes away.
 */
export function createServerRuntime(): ServerRuntime {
  // createRepoWatcher is passed explicitly; repo-watch-manager no longer imports infra directly.
  const repoWatchManager = createRepoWatchManager({ createWatcher: createRepoWatcher });
  const configWatcher = new RepositoryConfigWatcher();
  const validateRepository = validateRepositoryPath;
  const app = createApp({
    repoWatchManager,
    readConfig: () => configWatcher.readConfig(),
    validateRepository,
    repositoryConfigUpdater: createRepositoryConfigUpdater({
      invalidateConfig: () => configWatcher.invalidate(),
      validateRepository,
    }),
  });

  return {
    app,
    stop: async () => {
      await repoWatchManager.close();
      await configWatcher.stop();
    },
  };
}
