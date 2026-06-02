import type { ResolvedRepository } from '../../../domain/repository/repository';
import {
  deriveRepositoryId,
  deriveRepositoryName,
} from '../../../domain/repository/repository-identity';
import type { RegisteredRepositoryLister } from '../../services/repository-config';
import {
  DEFAULT_REPOSITORY_CONFIG_PATH,
  normalizeConfiguredRepositoryPath,
  readExistingRepositoryConfig,
} from './repository-config-store';

export interface CreateRegisteredRepositoryListerOptions {
  configPath?: string;
}

function toResolvedRepository(repositoryPath: string): ResolvedRepository {
  const normalizedPath = normalizeConfiguredRepositoryPath(repositoryPath);

  return {
    id: deriveRepositoryId(normalizedPath),
    name: deriveRepositoryName(normalizedPath),
    path: normalizedPath,
  };
}

export function createRegisteredRepositoryLister(
  options: CreateRegisteredRepositoryListerOptions = {},
): RegisteredRepositoryLister {
  const configPath = options.configPath ?? DEFAULT_REPOSITORY_CONFIG_PATH;
  const listRegisteredRepositories = async (): Promise<ResolvedRepository[]> => {
    const existingConfig = await readExistingRepositoryConfig(configPath);
    return existingConfig.repositories.map((entry) => toResolvedRepository(entry.path));
  };

  return {
    findRegisteredRepositoryByPath: async (
      repositoryPath: string,
    ): Promise<ResolvedRepository | null> => {
      const normalizedPath = normalizeConfiguredRepositoryPath(repositoryPath);
      const repositories = await listRegisteredRepositories();

      return repositories.find((repository) => repository.path === normalizedPath) ?? null;
    },
    listRegisteredRepositories,
  };
}
