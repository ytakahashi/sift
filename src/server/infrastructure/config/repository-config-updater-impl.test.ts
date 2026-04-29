import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RepositoryConfigParseError } from '../../../domain/repository/repository-config';
import { RepositoryAlreadyRegisteredError } from '../../../domain/repository/repository-config-update';
import {
  normalizeRepositoryPath,
  readExistingRepositoryConfig,
  writeRepositoryConfig,
} from '../../../local-config/repository-config-store';
import { createRepositoryConfigUpdater } from './repository-config-updater-impl';

vi.mock('../../../local-config/repository-config-store', () => ({
  normalizeRepositoryPath: vi.fn((repositoryPath: string) => repositoryPath),
  readExistingRepositoryConfig: vi.fn(),
  writeRepositoryConfig: vi.fn(),
}));

describe('createRepositoryConfigUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(normalizeRepositoryPath).mockImplementation((repositoryPath) => repositoryPath);
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

    // Then
    expect(repository).toEqual({ id: 'sift', path: '/repo/sift' });
    expect(readExistingRepositoryConfig).toHaveBeenCalledWith('/config/sift.json');
    expect(validateRepository).toHaveBeenCalledWith({ id: 'sift', path: '/repo/sift' });
    expect(writeRepositoryConfig).toHaveBeenCalledWith(
      {
        repositories: [{ id: 'sift', path: '/repo/sift' }],
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
      repositories: [{ id: 'sift', path: '/repo/sift' }],
    });
    const updater = createRepositoryConfigUpdater({
      configPath: '/config/sift.json',
      validateRepository: vi.fn(),
    });

    // When / Then
    await expect(updater.addRepository('/repo/sift')).rejects.toMatchObject({
      message: new RepositoryAlreadyRegisteredError('/repo/sift').message,
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
});
