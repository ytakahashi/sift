import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedRepository } from '../../domain/repository/repository';
import type { RegisteredRepositoryLister } from '../../server/index';
import { resolveInitialRepositoryIdForLaunch } from './initial-repository';

function createRepository(path: string, id = 'sift-abc123'): ResolvedRepository {
  return {
    id,
    name: 'sift',
    path,
  };
}

describe('resolveInitialRepositoryIdForLaunch', () => {
  const logger = {
    log: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing repository ID without adding when the current repo is registered', async () => {
    // Given
    const existingRepository = createRepository('/repo/sift');
    const addRepository = vi.fn();
    const lister: RegisteredRepositoryLister = {
      findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(existingRepository),
      listRegisteredRepositories: vi.fn(),
    };

    // When
    const repoId = await resolveInitialRepositoryIdForLaunch({
      createRegisteredRepositoryLister: () => lister,
      createRepositoryConfigUpdater: () => ({ addRepository }),
      currentWorkingDirectory: '/repo/sift/packages/client',
      logger,
      resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
    });

    // Then
    expect(repoId).toBe(existingRepository.id);
    expect(lister.findRegisteredRepositoryByPath).toHaveBeenCalledWith('/repo/sift');
    expect(addRepository).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('adds the current repository and returns its ID when it is not registered', async () => {
    // Given
    const addedRepository = createRepository('/repo/sift');
    const addRepository = vi.fn().mockResolvedValue(addedRepository);
    const lister: RegisteredRepositoryLister = {
      findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(null),
      listRegisteredRepositories: vi.fn(),
    };

    // When
    const repoId = await resolveInitialRepositoryIdForLaunch({
      createRegisteredRepositoryLister: () => lister,
      createRepositoryConfigUpdater: () => ({ addRepository }),
      currentWorkingDirectory: '/repo/sift/packages/client',
      logger,
      resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
    });

    // Then
    expect(repoId).toBe(addedRepository.id);
    expect(addRepository).toHaveBeenCalledWith('/repo/sift');
    expect(logger.log).toHaveBeenCalledWith(
      `Automatically registered repository: /repo/sift as "${addedRepository.id}"`,
    );
  });

  it('returns null without reading config when the current directory is not in a Git repository', async () => {
    // Given
    const createRegisteredRepositoryLister = vi.fn();
    const createRepositoryConfigUpdater = vi.fn();

    // When
    const repoId = await resolveInitialRepositoryIdForLaunch({
      createRegisteredRepositoryLister,
      createRepositoryConfigUpdater,
      currentWorkingDirectory: '/tmp',
      logger,
      resolveRepoRoot: vi.fn().mockImplementation(() => {
        throw new Error('Not a git repository');
      }),
    });

    // Then
    expect(repoId).toBeNull();
    expect(createRegisteredRepositoryLister).not.toHaveBeenCalled();
    expect(createRepositoryConfigUpdater).not.toHaveBeenCalled();
  });

  it('returns null and warns when the repository config cannot be queried', async () => {
    // Given
    const addRepository = vi.fn();
    const lister: RegisteredRepositoryLister = {
      findRegisteredRepositoryByPath: vi.fn().mockRejectedValue(new Error('Invalid JSON config')),
      listRegisteredRepositories: vi.fn(),
    };

    // When
    const repoId = await resolveInitialRepositoryIdForLaunch({
      createRegisteredRepositoryLister: () => lister,
      createRepositoryConfigUpdater: () => ({ addRepository }),
      currentWorkingDirectory: '/repo/sift',
      logger,
      resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
    });

    // Then
    expect(repoId).toBeNull();
    expect(addRepository).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to automatically register repository: Invalid JSON config',
    );
  });
});
