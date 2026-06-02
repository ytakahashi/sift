import {
  createRegisteredRepositoryLister,
  createRepositoryConfigUpdater,
  type RegisteredRepositoryLister,
  type RepositoryConfigUpdater,
} from '../server/index';
import { resolveRepoRoot } from './resolve-repo';

interface Logger {
  log(message: string): void;
  warn(message: string): void;
}

export interface ResolveInitialRepositoryIdOptions {
  createRegisteredRepositoryLister?: () => RegisteredRepositoryLister;
  createRepositoryConfigUpdater?: () => Pick<RepositoryConfigUpdater, 'addRepository'>;
  currentWorkingDirectory?: string;
  logger?: Logger;
  resolveRepoRoot?: (targetPath?: string) => string;
}

export async function resolveInitialRepositoryIdForLaunch(
  options: ResolveInitialRepositoryIdOptions = {},
): Promise<string | null> {
  const currentWorkingDirectory = options.currentWorkingDirectory ?? process.cwd();
  const logger = options.logger ?? console;
  const resolveRoot = options.resolveRepoRoot ?? resolveRepoRoot;

  let gitRepoRoot: string;
  try {
    gitRepoRoot = resolveRoot(currentWorkingDirectory);
  } catch (_error: unknown) {
    return null;
  }

  const lister = (options.createRegisteredRepositoryLister ?? createRegisteredRepositoryLister)();

  try {
    const existingRepository = await lister.findRegisteredRepositoryByPath(gitRepoRoot);
    if (existingRepository) {
      return existingRepository.id;
    }

    const updater = (options.createRepositoryConfigUpdater ?? createRepositoryConfigUpdater)();
    const addedRepository = await updater.addRepository(gitRepoRoot);
    logger.log(
      `Automatically registered repository: ${addedRepository.path} as "${addedRepository.id}"`,
    );
    return addedRepository.id;
  } catch (error: unknown) {
    logger.warn(
      `Failed to automatically register repository: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}
