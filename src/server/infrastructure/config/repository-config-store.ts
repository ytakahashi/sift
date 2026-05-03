import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import {
  formatRepositoryConfig,
  parseRepositoryConfig,
  type RepositoryConfig,
  RepositoryConfigParseError,
} from './repository-config-schema';

export const DEFAULT_REPOSITORY_CONFIG_PATH = path.join(
  homedir(),
  '.config',
  'sift',
  'config.json',
);

/**
 * Normalizes a configured repository path using string spelling only.
 *
 * Sift intentionally hashes the normalized path spelling, not `realpath`,
 * because the first implementation favors a simple deterministic rule even
 * though symlink aliases can produce different IDs for the same underlying
 * repository.
 *
 * Case-only spelling differences are also accepted as part of this tradeoff.
 * Paths are not lowercased before hashing because case-sensitive filesystems
 * can treat paths such as `/repo/App` and `/repo/app` as different
 * repositories.
 */
export function normalizeConfiguredRepositoryPath(repositoryPath: string): string {
  // Guard against empty or whitespace-only paths. path.resolve('') would
  // silently return process.cwd(), turning a malformed config entry into
  // what looks like a valid local directory.
  if (!repositoryPath.trim()) {
    return '';
  }

  return path.resolve(repositoryPath);
}

type FileReadError = Error & { code?: string };

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error as FileReadError).code === 'ENOENT';
}

export async function readExistingRepositoryConfig(configPath: string): Promise<RepositoryConfig> {
  try {
    return parseRepositoryConfig(await readFile(configPath, 'utf8'));
  } catch (error: unknown) {
    if (error instanceof RepositoryConfigParseError) {
      throw error;
    }

    if (!isFileNotFoundError(error)) {
      throw error;
    }

    return {
      repositories: [],
    };
  }
}

export async function writeRepositoryConfig(
  config: RepositoryConfig,
  configPath: string,
): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, formatRepositoryConfig(config), 'utf8');
}
