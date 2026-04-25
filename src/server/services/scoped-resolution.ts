import type { RepositoryConfigReadResult } from '../infrastructure/config/repository-config-reader';
import {
  createRepositoryRegistry,
  RepositoryRegistryError,
} from '../repositories/repository-registry';
import type { RepositoryDescriptor } from '../../domain/repository/repository';

export class ScopedRepositoryResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopedRepositoryResolutionError';
  }
}

export function resolveScopedRepository(
  configResult: RepositoryConfigReadResult,
  repoId: string | undefined,
): RepositoryDescriptor {
  if (!repoId) {
    throw new ScopedRepositoryResolutionError('Repository id is required.');
  }

  if (configResult.status === 'missing') {
    throw new ScopedRepositoryResolutionError(
      `Repository config is missing: ${configResult.configPath}`,
    );
  }

  if (configResult.status === 'invalid') {
    throw new ScopedRepositoryResolutionError(
      `Repository config is invalid: ${configResult.error}`,
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
