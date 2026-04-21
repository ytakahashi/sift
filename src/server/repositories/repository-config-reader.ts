import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { ServerRepository } from './server-repository';

export interface RepositoryConfig {
  repositories: ServerRepository[];
}

export const DEFAULT_REPOSITORY_CONFIG_PATH = path.join(
  homedir(),
  '.config',
  'sift',
  'config.json',
);

export class RepositoryConfigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryConfigParseError';
  }
}

export interface FoundRepositoryConfig {
  config: RepositoryConfig;
  status: 'found';
}

export interface MissingRepositoryConfig {
  configPath: string;
  status: 'missing';
}

export type RepositoryConfigReadResult = FoundRepositoryConfig | MissingRepositoryConfig;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson(rawConfig: string): unknown {
  try {
    return JSON.parse(rawConfig) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RepositoryConfigParseError(`Invalid JSON config: ${message}`);
  }
}

function toRepository(value: unknown, index: number): ServerRepository {
  if (!isRecord(value)) {
    throw new RepositoryConfigParseError(`Repository entry at index ${index} must be an object.`);
  }

  const { id, path: repositoryPath } = value;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new RepositoryConfigParseError(
      `Repository entry at index ${index} must have a non-empty string "id".`,
    );
  }

  if (typeof repositoryPath !== 'string' || repositoryPath.trim() === '') {
    throw new RepositoryConfigParseError(
      `Repository entry "${id}" must have a non-empty string "path".`,
    );
  }

  return {
    id,
    path: repositoryPath,
  };
}

function toRepositoryConfig(value: unknown): RepositoryConfig {
  if (!isRecord(value)) {
    throw new RepositoryConfigParseError('Config root must be an object.');
  }

  if (!Array.isArray(value.repositories)) {
    throw new RepositoryConfigParseError('Config must contain a "repositories" array.');
  }

  return {
    repositories: value.repositories.map((repository, index) => toRepository(repository, index)),
  };
}

export function parseRepositoryConfig(rawConfig: string): RepositoryConfig {
  return toRepositoryConfig(parseJson(rawConfig));
}

export async function readRepositoryConfig(
  configPath: string = DEFAULT_REPOSITORY_CONFIG_PATH,
): Promise<RepositoryConfigReadResult> {
  try {
    const rawConfig = await readFile(configPath, 'utf8');
    return {
      config: parseRepositoryConfig(rawConfig),
      status: 'found',
    };
  } catch {
    // Treat all read failures as "missing" so callers only need one setup-state
    // branch; splitting ENOENT, permission, and other IO failures would make
    // repository selection flow more complex without changing the next action.
    return {
      configPath,
      status: 'missing',
    };
  }
}
