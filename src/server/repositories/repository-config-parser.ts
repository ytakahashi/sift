import type { ServerRepository } from './server-repository';

export interface RepositoryConfig {
  repositories: ServerRepository[];
}

export class RepositoryConfigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryConfigParseError';
  }
}

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
    return { id: `invalid-repo-${index}`, path: '' };
  }

  const { id, path: repositoryPath } = value;
  const resolvedId = typeof id === 'string' && id.trim() !== '' ? id : `invalid-id-${index}`;
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
