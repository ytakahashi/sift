import chokidar, { type FSWatcher } from 'chokidar';
import {
  DEFAULT_REPOSITORY_CONFIG_PATH,
  readRepositoryConfig,
  type RepositoryConfigReadResult,
} from './repository-config-reader';

export class RepositoryConfigWatcher {
  private configPath: string;
  private cachedConfig: RepositoryConfigReadResult | null = null;
  private watcher: FSWatcher | null = null;

  constructor(configPath: string = DEFAULT_REPOSITORY_CONFIG_PATH) {
    this.configPath = configPath;
  }

  async readConfig(): Promise<RepositoryConfigReadResult> {
    if (!this.cachedConfig) {
      this.cachedConfig = await readRepositoryConfig(this.configPath);
      this.startWatching();
    }
    return this.cachedConfig;
  }

  private startWatching(): void {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch(this.configPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10,
      },
    });

    this.watcher.on('all', () => {
      // Clear cache on any change, addition, or deletion.
      this.cachedConfig = null;
    });
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
