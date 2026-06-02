import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deriveRepositoryId,
  deriveRepositoryName,
} from '../../../domain/repository/repository-identity';
import {
  normalizeConfiguredRepositoryPath,
  readExistingRepositoryConfig,
} from './repository-config-store';
import { createRegisteredRepositoryLister } from './repository-config-lister-impl';

vi.mock('./repository-config-store', () => ({
  DEFAULT_REPOSITORY_CONFIG_PATH: '/default/config.json',
  normalizeConfiguredRepositoryPath: vi.fn((repositoryPath: string) => repositoryPath),
  readExistingRepositoryConfig: vi.fn(),
}));

describe('createRegisteredRepositoryLister', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(normalizeConfiguredRepositoryPath).mockImplementation(
      (repositoryPath) => repositoryPath,
    );
  });

  it('lists registered repositories with runtime-derived metadata', async () => {
    // Given
    vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
      repositories: [{ path: '/repo/sift' }, { path: '/repo/other' }],
    });
    const lister = createRegisteredRepositoryLister({ configPath: '/config/sift.json' });

    // When
    const repositories = await lister.listRegisteredRepositories();

    // Then
    expect(readExistingRepositoryConfig).toHaveBeenCalledWith('/config/sift.json');
    expect(repositories).toEqual([
      {
        id: deriveRepositoryId('/repo/sift'),
        name: deriveRepositoryName('/repo/sift'),
        path: '/repo/sift',
      },
      {
        id: deriveRepositoryId('/repo/other'),
        name: deriveRepositoryName('/repo/other'),
        path: '/repo/other',
      },
    ]);
  });

  it('finds an existing repository by normalized path', async () => {
    // Given
    vi.mocked(normalizeConfiguredRepositoryPath).mockImplementation((repositoryPath) => {
      if (repositoryPath === '/repo/link-to-sift') {
        return '/repo/sift';
      }
      return repositoryPath;
    });
    vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
      repositories: [{ path: '/repo/sift' }],
    });
    const lister = createRegisteredRepositoryLister({ configPath: '/config/sift.json' });

    // When
    const repository = await lister.findRegisteredRepositoryByPath('/repo/link-to-sift');

    // Then
    expect(repository).toEqual({
      id: deriveRepositoryId('/repo/sift'),
      name: deriveRepositoryName('/repo/sift'),
      path: '/repo/sift',
    });
  });

  it('returns null when no registered repository matches the path', async () => {
    // Given
    vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
      repositories: [{ path: '/repo/other' }],
    });
    const lister = createRegisteredRepositoryLister({ configPath: '/config/sift.json' });

    // When
    const repository = await lister.findRegisteredRepositoryByPath('/repo/sift');

    // Then
    expect(repository).toBeNull();
  });
});
