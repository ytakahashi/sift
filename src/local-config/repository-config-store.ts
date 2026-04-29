import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseRepositoryConfig,
  type RepositoryConfig,
  RepositoryConfigParseError,
} from '../domain/repository/repository-config';
import type { AddedRepository } from '../domain/repository/repository-config-update';
import { addRepositoryToConfig } from '../domain/repository/repository-config-update';
import { DEFAULT_REPOSITORY_CONFIG_PATH } from './repository-config-path';

type FileReadError = Error & { code?: string };

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error as FileReadError).code === 'ENOENT';
}

export function normalizeRepositoryPath(repositoryPath: string): string {
  return path.resolve(repositoryPath);
}

export function formatRepositoryConfig(config: RepositoryConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
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

export async function addRepositoryConfigEntry(
  repositoryPath: string,
  configPath: string = DEFAULT_REPOSITORY_CONFIG_PATH,
): Promise<AddedRepository> {
  const existingConfig = await readExistingRepositoryConfig(configPath);
  const result = addRepositoryToConfig(existingConfig, normalizeRepositoryPath(repositoryPath));

  await writeRepositoryConfig(result.config, configPath);

  return result.repository;
}
