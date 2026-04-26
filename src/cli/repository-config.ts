import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_REPOSITORY_CONFIG_PATH } from '../local-config/repository-config-path';
import {
  parseRepositoryConfig,
  type RepositoryConfig,
  RepositoryConfigParseError,
} from '../domain/repository/repository-config';
import type { RepositoryDescriptor } from '../domain/repository/repository';

export interface AddedRepository {
  id: string;
  path: string;
}

export interface AddRepositoryToConfigResult {
  config: RepositoryConfig;
  repository: AddedRepository;
}

export class RepositoryAlreadyRegisteredError extends Error {
  constructor(repositoryPath: string) {
    super(`Repository is already registered: ${repositoryPath}`);
    this.name = 'RepositoryAlreadyRegisteredError';
  }
}

type FileReadError = Error & { code?: string };

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error as FileReadError).code === 'ENOENT';
}

function normalizeRepositoryPath(repositoryPath: string): string {
  return path.resolve(repositoryPath);
}

export function slugifyRepositoryId(repositoryName: string): string {
  const slug = repositoryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'repository';
}

export function createAvailableRepositoryId(
  candidateId: string,
  repositories: RepositoryDescriptor[],
): string {
  const existingIds = new Set(repositories.map((repository) => repository.id));
  if (!existingIds.has(candidateId)) {
    return candidateId;
  }

  let suffix = 2;
  while (existingIds.has(`${candidateId}-${suffix}`)) {
    suffix += 1;
  }

  return `${candidateId}-${suffix}`;
}

export function addRepositoryToConfig(
  config: RepositoryConfig,
  repositoryPath: string,
): AddRepositoryToConfigResult {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);
  const alreadyRegistered = config.repositories.some(
    (repository) => normalizeRepositoryPath(repository.path) === normalizedPath,
  );

  if (alreadyRegistered) {
    throw new RepositoryAlreadyRegisteredError(normalizedPath);
  }

  const candidateId = slugifyRepositoryId(path.basename(normalizedPath));
  const repository = {
    id: createAvailableRepositoryId(candidateId, config.repositories),
    path: normalizedPath,
  };

  return {
    config: {
      repositories: [...config.repositories, repository],
    },
    repository,
  };
}

function formatRepositoryConfig(config: RepositoryConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

async function readExistingRepositoryConfig(configPath: string): Promise<RepositoryConfig> {
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

export async function addRepositoryConfigEntry(
  repositoryPath: string,
  configPath: string = DEFAULT_REPOSITORY_CONFIG_PATH,
): Promise<AddedRepository> {
  const existingConfig = await readExistingRepositoryConfig(configPath);
  const result = addRepositoryToConfig(existingConfig, repositoryPath);

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, formatRepositoryConfig(result.config), 'utf8');

  return result.repository;
}
