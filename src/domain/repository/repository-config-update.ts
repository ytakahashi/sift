import type { RepositoryDescriptor } from './repository';
import type { RepositoryConfig } from './repository-config';

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

function trimTrailingSlashes(repositoryPath: string): string {
  return repositoryPath.replace(/\/+$/g, '') || repositoryPath;
}

function deriveRepositoryName(repositoryPath: string): string {
  const normalizedPath = trimTrailingSlashes(repositoryPath);
  const segments = normalizedPath.split('/').filter((segment) => segment.length > 0);
  return segments.at(-1) ?? normalizedPath;
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
  const normalizedPath = trimTrailingSlashes(repositoryPath);
  const alreadyRegistered = config.repositories.some(
    (repository) => trimTrailingSlashes(repository.path) === normalizedPath,
  );

  if (alreadyRegistered) {
    throw new RepositoryAlreadyRegisteredError(normalizedPath);
  }

  const candidateId = slugifyRepositoryId(deriveRepositoryName(normalizedPath));
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
