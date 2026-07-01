import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedRepository } from '../../domain/repository/repository';
import type { RegisteredRepositoryLister } from '../../server/index';
import { resolveRepositoryIdForOpen } from './resolve-repository-for-open';

function createRepository(path: string, id = 'sift-abc123'): ResolvedRepository {
  return {
    id,
    name: 'sift',
    path,
  };
}

describe('resolveRepositoryIdForOpen', () => {
  const logger = {
    log: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing repository ID without adding when the target repo is registered', async () => {
    // Given
    const existingRepository = createRepository('/repo/sift');
    const addRepository = vi.fn();
    const lister: RegisteredRepositoryLister = {
      findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(existingRepository),
      listRegisteredRepositories: vi.fn(),
    };

    // When
    const repoId = await resolveRepositoryIdForOpen('/repo/sift/packages/client', {
      createRegisteredRepositoryLister: () => lister,
      createRepositoryConfigUpdater: () => ({ addRepository }),
      logger,
      resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
    });

    // Then
    expect(repoId).toBe(existingRepository.id);
    expect(lister.findRegisteredRepositoryByPath).toHaveBeenCalledWith('/repo/sift');
    expect(addRepository).not.toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('adds the target repository and returns its ID when it is not registered', async () => {
    // Given
    const addedRepository = createRepository('/repo/sift');
    const addRepository = vi.fn().mockResolvedValue(addedRepository);
    const lister: RegisteredRepositoryLister = {
      findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(null),
      listRegisteredRepositories: vi.fn(),
    };

    // When
    const repoId = await resolveRepositoryIdForOpen('/repo/sift/packages/client', {
      createRegisteredRepositoryLister: () => lister,
      createRepositoryConfigUpdater: () => ({ addRepository }),
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

  it('returns null without reading config when the current directory is not a Git repository', async () => {
    // Given
    const createRegisteredRepositoryLister = vi.fn();
    const createRepositoryConfigUpdater = vi.fn();

    // When
    const repoId = await resolveRepositoryIdForOpen(undefined, {
      createRegisteredRepositoryLister,
      createRepositoryConfigUpdater,
      logger,
      resolveRepoRoot: vi.fn().mockImplementation(() => {
        throw new Error('Not a git repository');
      }),
    });

    // Then
    // The cwd-defaulted target is best-effort auto-detection for bare
    // `sift open`, so a resolution failure falls back to null (base URL)
    // instead of failing the command.
    expect(repoId).toBeNull();
    expect(createRegisteredRepositoryLister).not.toHaveBeenCalled();
    expect(createRepositoryConfigUpdater).not.toHaveBeenCalled();
  });

  it('returns null and warns when the repository config cannot be queried for the current directory', async () => {
    // Given
    const addRepository = vi.fn();
    const lister: RegisteredRepositoryLister = {
      findRegisteredRepositoryByPath: vi.fn().mockRejectedValue(new Error('Invalid JSON config')),
      listRegisteredRepositories: vi.fn(),
    };

    // When
    const repoId = await resolveRepositoryIdForOpen(undefined, {
      createRegisteredRepositoryLister: () => lister,
      createRepositoryConfigUpdater: () => ({ addRepository }),
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

  it('throws instead of returning null when an explicit target path is not a Git repository', async () => {
    // Given
    const createRegisteredRepositoryLister = vi.fn();
    const createRepositoryConfigUpdater = vi.fn();
    const notAGitRepoError = new Error('Not a git repository');

    // When
    const resultPromise = resolveRepositoryIdForOpen('/explicit/path', {
      createRegisteredRepositoryLister,
      createRepositoryConfigUpdater,
      logger,
      resolveRepoRoot: vi.fn().mockImplementation(() => {
        throw notAGitRepoError;
      }),
    });

    // Then
    // `sift open /explicit/path` is an unambiguous request to open that
    // repo, so the caller should see the failure rather than silently
    // opening the server's base URL.
    await expect(resultPromise).rejects.toBe(notAGitRepoError);
    expect(createRegisteredRepositoryLister).not.toHaveBeenCalled();
    expect(createRepositoryConfigUpdater).not.toHaveBeenCalled();
  });

  it('throws instead of returning null when registration fails for an explicit target path', async () => {
    // Given
    const addRepository = vi.fn();
    const configError = new Error('Invalid JSON config');
    const lister: RegisteredRepositoryLister = {
      findRegisteredRepositoryByPath: vi.fn().mockRejectedValue(configError),
      listRegisteredRepositories: vi.fn(),
    };

    // When
    const resultPromise = resolveRepositoryIdForOpen('/explicit/path', {
      createRegisteredRepositoryLister: () => lister,
      createRepositoryConfigUpdater: () => ({ addRepository }),
      logger,
      resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
    });

    // Then
    await expect(resultPromise).rejects.toBe(configError);
    expect(addRepository).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('defaults to the current directory when no target path is given', async () => {
    // Given
    const existingRepository = createRepository('/repo/sift');
    const lister: RegisteredRepositoryLister = {
      findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(existingRepository),
      listRegisteredRepositories: vi.fn(),
    };
    const resolveRepoRootMock = vi.fn().mockReturnValue('/repo/sift');

    // When
    await resolveRepositoryIdForOpen(undefined, {
      createRegisteredRepositoryLister: () => lister,
      logger,
      resolveRepoRoot: resolveRepoRootMock,
    });

    // Then
    // The default cwd resolution is owned by resolveRepoRoot itself, so the
    // helper must forward `undefined` rather than pre-resolving process.cwd().
    expect(resolveRepoRootMock).toHaveBeenCalledWith(undefined);
  });
});
