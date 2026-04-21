import { DEFAULT_REPO_ID } from '../../domain/repository/repository';
import type { RepositoryConfigReadResult } from './repository-config-reader';
import { createRepositoryRegistry, RepositoryRegistryError } from './repository-registry';
import type { ServerRepository } from './server-repository';

export class ScopedRepositoryResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopedRepositoryResolutionError';
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resolveScopedRepository(
  configResult: RepositoryConfigReadResult,
  repoId: string | undefined,
  defaultRepository?: ServerRepository,
): ServerRepository {
  if (!repoId) {
    throw new ScopedRepositoryResolutionError('Repository id is required.');
  }

  if (configResult.status === 'missing') {
    if (repoId === DEFAULT_REPO_ID && defaultRepository) {
      return defaultRepository;
    }

    throw new ScopedRepositoryResolutionError(
      `Repository config is missing: ${configResult.configPath}`,
    );
  }

  try {
    const registry = createRepositoryRegistry(configResult.config.repositories);
    return registry.resolve(repoId);
  } catch (error: unknown) {
    if (error instanceof RepositoryRegistryError) {
      throw new ScopedRepositoryResolutionError(error.message);
    }

    throw error;
  }
}
