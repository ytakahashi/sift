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

export interface InvalidRepositoryConfig {
  configPath: string;
  error: string;
  status: 'invalid';
}

export type RepositoryConfigReadResult =
  | FoundRepositoryConfig
  | MissingRepositoryConfig
  | InvalidRepositoryConfig;

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
    return { id: `__invalid_${index}`, path: '' };
  }

  const { id, path: repositoryPath } = value;
  const resolvedId = typeof id === 'string' && id.trim() !== '' ? id : `__invalid_id_${index}`;
  const resolvedPath = typeof repositoryPath === 'string' ? repositoryPath : '';

  return {
    id: resolvedId,
    path: resolvedPath,
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
  let rawConfig: string;
  try {
    rawConfig = await readFile(configPath, 'utf8');
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return { configPath, status: 'missing' };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { configPath, error: `Failed to read config file: ${message}`, status: 'invalid' };
  }

  try {
    return {
      config: parseRepositoryConfig(rawConfig),
      status: 'found',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { configPath, error: message, status: 'invalid' };
  }
}
