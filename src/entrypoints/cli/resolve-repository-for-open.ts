import {
  createRegisteredRepositoryLister,
  createRepositoryConfigUpdater,
  type RegisteredRepositoryLister,
  type RepositoryConfigUpdater,
} from '../../server/index';
import { resolveRepoRoot } from './resolve-repo';

interface Logger {
  log(message: string): void;
  warn(message: string): void;
}

export interface ResolveRepositoryIdForOpenOptions {
  createRegisteredRepositoryLister?: () => RegisteredRepositoryLister;
  createRepositoryConfigUpdater?: () => Pick<RepositoryConfigUpdater, 'addRepository'>;
  logger?: Logger;
  resolveRepoRoot?: (targetPath?: string) => string;
}

export async function resolveRepositoryIdForOpen(
  targetPath?: string,
  options: ResolveRepositoryIdForOpenOptions = {},
): Promise<string | null> {
  const logger = options.logger ?? console;
  const resolveRoot = options.resolveRepoRoot ?? resolveRepoRoot;
  // An explicit path is a direct request to open that repo, so resolution or
  // registration failures must surface as errors. A defaulted (cwd) target is
  // best-effort auto-detection for the zero-argument `sift open` convenience,
  // so it keeps failing silently and falls back to the server's base URL.
  const hasExplicitTarget = targetPath !== undefined;

  let gitRepoRoot: string;
  try {
    gitRepoRoot = resolveRoot(targetPath);
  } catch (error: unknown) {
    if (hasExplicitTarget) {
      throw error;
    }
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
    if (hasExplicitTarget) {
      throw error;
    }
    logger.warn(
      `Failed to automatically register repository: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}
