import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { parseRepositoryConfig, type RepositoryConfig } from './repository-config-parser';

export const DEFAULT_REPOSITORY_CONFIG_PATH = path.join(
  homedir(),
  '.config',
  'sift',
  'config.json',
);

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
