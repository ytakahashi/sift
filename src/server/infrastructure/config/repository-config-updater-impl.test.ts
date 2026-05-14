import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  deriveRepositoryId,
  deriveRepositoryName,
} from '../../../domain/repository/repository-identity';
import { RepositoryConfigParseError } from './repository-config-schema';
import {
  normalizeConfiguredRepositoryPath,
  readExistingRepositoryConfig,
  writeRepositoryConfig,
} from './repository-config-store';
import { createRepositoryConfigUpdater } from './repository-config-updater-impl';

vi.mock('./repository-config-store', () => ({
  DEFAULT_REPOSITORY_CONFIG_PATH: '/default/config.json',
  normalizeConfiguredRepositoryPath: vi.fn((repositoryPath: string) => repositoryPath),
  readExistingRepositoryConfig: vi.fn(),
  writeRepositoryConfig: vi.fn(),
}));

describe('createRepositoryConfigUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(normalizeConfiguredRepositoryPath).mockImplementation(
      (repositoryPath) => repositoryPath,
    );
  });

  it('adds a valid repository to the config and invalidates the cache', async () => {
    // Given
    const validateRepository = vi.fn().mockResolvedValue({ isValid: true });
    const invalidateConfig = vi.fn();
    vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
      repositories: [],
    });
    vi.mocked(writeRepositoryConfig).mockResolvedValue(undefined);
    const updater = createRepositoryConfigUpdater({
      configPath: '/config/sift.json',
      invalidateConfig,
      validateRepository,
    });

    // When
    const repository = await updater.addRepository('/repo/sift');

    // Then — the returned repository uses the runtime-derived ID and name
    const expectedId = deriveRepositoryId('/repo/sift');
    const expectedName = deriveRepositoryName('/repo/sift');
    expect(repository).toEqual({ id: expectedId, name: expectedName, path: '/repo/sift' });
    expect(readExistingRepositoryConfig).toHaveBeenCalledWith('/config/sift.json');
    expect(validateRepository).toHaveBeenCalledWith({ id: expectedId, path: '/repo/sift' });
    // Config file should contain path-only entries
    expect(writeRepositoryConfig).toHaveBeenCalledWith(
      {
        repositories: [{ path: '/repo/sift' }],
      },
      '/config/sift.json',
    );
    expect(invalidateConfig).toHaveBeenCalledTimes(1);
  });

  it('rejects relative repository paths before reading the config', async () => {
    // Given
    const updater = createRepositoryConfigUpdater({
      configPath: '/config/sift.json',
      validateRepository: vi.fn(),
    });

    // When / Then
    await expect(updater.addRepository('repo/sift')).rejects.toThrow(
      'Repository path must be an absolute path.',
    );
    expect(readExistingRepositoryConfig).not.toHaveBeenCalled();
  });

  it('maps duplicate paths to a conflict error without writing', async () => {
    // Given
    vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
      repositories: [{ path: '/repo/sift' }],
    });
    const updater = createRepositoryConfigUpdater({
      configPath: '/config/sift.json',
      validateRepository: vi.fn(),
    });

    // When / Then
    await expect(updater.addRepository('/repo/sift')).rejects.toMatchObject({
      message: 'Repository is already registered: /repo/sift',
      statusCode: 409,
    });
    expect(writeRepositoryConfig).not.toHaveBeenCalled();
  });

  it('maps malformed existing config to a validation error without writing', async () => {
    // Given
    vi.mocked(readExistingRepositoryConfig).mockRejectedValue(
      new RepositoryConfigParseError('Invalid JSON config: Unexpected end of JSON input'),
    );
    const updater = createRepositoryConfigUpdater({
      configPath: '/config/sift.json',
      validateRepository: vi.fn(),
    });

    // When / Then
    await expect(updater.addRepository('/repo/sift')).rejects.toMatchObject({
      message: 'Invalid JSON config: Unexpected end of JSON input',
      statusCode: 400,
    });
    expect(writeRepositoryConfig).not.toHaveBeenCalled();
  });

  it('does not write when repository validation fails', async () => {
    // Given
    const validateRepository = vi.fn().mockResolvedValue({
      error: 'Repository path must be the Git repository root.',
      isValid: false,
    });
    vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
      repositories: [],
    });
    const updater = createRepositoryConfigUpdater({
      configPath: '/config/sift.json',
      validateRepository,
    });

    // When / Then
    await expect(updater.addRepository('/repo/sift/src')).rejects.toMatchObject({
      message: 'Repository path must be the Git repository root.',
      statusCode: 400,
    });
    expect(writeRepositoryConfig).not.toHaveBeenCalled();
  });

  describe('removeRepository', () => {
    it('removes the repository and invalidates the cache', async () => {
      // Given
      const invalidateConfig = vi.fn();
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [{ path: '/repo/a' }, { path: '/repo/b' }],
      });
      vi.mocked(writeRepositoryConfig).mockResolvedValue(undefined);
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        invalidateConfig,
      });

      // When
      await updater.removeRepository(deriveRepositoryId('/repo/a'));

      // Then
      expect(readExistingRepositoryConfig).toHaveBeenCalledWith('/config/sift.json');
      expect(writeRepositoryConfig).toHaveBeenCalledWith(
        { repositories: [{ path: '/repo/b' }] },
        '/config/sift.json',
      );
      expect(invalidateConfig).toHaveBeenCalledTimes(1);
    });

    it('does nothing when repository ID is not found', async () => {
      // Given
      const invalidateConfig = vi.fn();
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [{ path: '/repo/b' }],
      });
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        invalidateConfig,
      });

      // When
      const repoId = deriveRepositoryId('/repo/a');

      await updater.removeRepository(repoId);

      // Then
      expect(writeRepositoryConfig).not.toHaveBeenCalled();
      expect(invalidateConfig).not.toHaveBeenCalled();
    });

    it('throws 409 when multiple repositories match the ID', async () => {
      // Given
      const invalidateConfig = vi.fn();
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [{ path: '/repo/a' }, { path: '/repo/a' }],
      });
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        invalidateConfig,
      });

      // When / Then
      const repoId = deriveRepositoryId('/repo/a');
      await expect(updater.removeRepository(repoId)).rejects.toMatchObject({
        message: `Repository id "${repoId}" is duplicated.`,
        statusCode: 409,
      });
      expect(writeRepositoryConfig).not.toHaveBeenCalled();
      expect(invalidateConfig).not.toHaveBeenCalled();
    });

    it('maps malformed existing config to a validation error without writing', async () => {
      // Given
      const invalidateConfig = vi.fn();
      vi.mocked(readExistingRepositoryConfig).mockRejectedValue(
        new RepositoryConfigParseError('Invalid JSON config'),
      );
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        invalidateConfig,
      });

      // When / Then
      await expect(updater.removeRepository(deriveRepositoryId('/repo/a'))).rejects.toMatchObject({
        message: 'Invalid JSON config',
        statusCode: 400,
      });
      expect(writeRepositoryConfig).not.toHaveBeenCalled();
      expect(invalidateConfig).not.toHaveBeenCalled();
    });
  });

  describe('reorderRepositories', () => {
    it('writes resolved repositories in the requested order and invalidates the cache', async () => {
      // Given
      const invalidateConfig = vi.fn();
      const validateRepository = vi.fn().mockResolvedValue({ isValid: true });
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [{ path: '/repo/a' }, { path: '/repo/b' }, { path: '/repo/c' }],
      });
      vi.mocked(writeRepositoryConfig).mockResolvedValue(undefined);
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        invalidateConfig,
        validateRepository,
      });

      // When
      await updater.reorderRepositories([
        deriveRepositoryId('/repo/c'),
        deriveRepositoryId('/repo/a'),
        deriveRepositoryId('/repo/b'),
      ]);

      // Then
      expect(writeRepositoryConfig).toHaveBeenCalledWith(
        {
          repositories: [{ path: '/repo/c' }, { path: '/repo/a' }, { path: '/repo/b' }],
        },
        '/config/sift.json',
      );
      expect(invalidateConfig).toHaveBeenCalledTimes(1);
    });

    it('keeps invalid repositories after reordered resolved repositories', async () => {
      // Given
      const validateRepository = vi.fn().mockImplementation(({ path: repositoryPath }) =>
        Promise.resolve({
          isValid: repositoryPath !== '/repo/missing-a' && repositoryPath !== '/repo/missing-b',
        }),
      );
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [
          { path: '/repo/a' },
          { path: '/repo/missing-a' },
          { path: '/repo/b' },
          { path: '/repo/missing-b' },
        ],
      });
      vi.mocked(writeRepositoryConfig).mockResolvedValue(undefined);
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        validateRepository,
      });

      // When
      await updater.reorderRepositories([
        deriveRepositoryId('/repo/b'),
        deriveRepositoryId('/repo/a'),
      ]);

      // Then
      expect(writeRepositoryConfig).toHaveBeenCalledWith(
        {
          repositories: [
            { path: '/repo/b' },
            { path: '/repo/a' },
            { path: '/repo/missing-a' },
            { path: '/repo/missing-b' },
          ],
        },
        '/config/sift.json',
      );
    });

    it('throws 409 when configured repository IDs are duplicated', async () => {
      // Given
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [{ path: '/repo/a' }, { path: '/repo/a' }],
      });
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        validateRepository: vi.fn(),
      });

      // When / Then
      const repoId = deriveRepositoryId('/repo/a');
      await expect(updater.reorderRepositories([repoId])).rejects.toMatchObject({
        message: `Repository id "${repoId}" is duplicated.`,
        statusCode: 409,
      });
      expect(writeRepositoryConfig).not.toHaveBeenCalled();
    });

    it('throws 400 when the reorder request contains duplicate IDs', async () => {
      // Given
      const validateRepository = vi.fn().mockResolvedValue({ isValid: true });
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [{ path: '/repo/a' }, { path: '/repo/b' }],
      });
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        validateRepository,
      });

      // When / Then
      const repoId = deriveRepositoryId('/repo/a');
      await expect(updater.reorderRepositories([repoId, repoId])).rejects.toMatchObject({
        message: 'Reorder request contains duplicate IDs.',
        statusCode: 400,
      });
      expect(writeRepositoryConfig).not.toHaveBeenCalled();
    });

    it('throws 400 when the reorder request omits resolved repository IDs', async () => {
      // Given
      const validateRepository = vi.fn().mockResolvedValue({ isValid: true });
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [{ path: '/repo/a' }, { path: '/repo/b' }],
      });
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        validateRepository,
      });

      // When / Then
      await expect(
        updater.reorderRepositories([deriveRepositoryId('/repo/a')]),
      ).rejects.toMatchObject({
        message: 'Reorder request must include all resolved repository IDs.',
        statusCode: 400,
      });
      expect(writeRepositoryConfig).not.toHaveBeenCalled();
    });

    it('throws 400 when the reorder request contains an unknown repository ID', async () => {
      // Given
      const validateRepository = vi.fn().mockResolvedValue({ isValid: true });
      vi.mocked(readExistingRepositoryConfig).mockResolvedValue({
        repositories: [{ path: '/repo/a' }, { path: '/repo/b' }],
      });
      const updater = createRepositoryConfigUpdater({
        configPath: '/config/sift.json',
        validateRepository,
      });

      // When / Then
      await expect(
        updater.reorderRepositories([deriveRepositoryId('/repo/a'), deriveRepositoryId('/repo/c')]),
      ).rejects.toMatchObject({
        message: `Repository id "${deriveRepositoryId('/repo/c')}" is not configured.`,
        statusCode: 400,
      });
      expect(writeRepositoryConfig).not.toHaveBeenCalled();
    });
  });
});
