import { describe, expect, it } from 'vitest';
import { createRepositoryResolver } from './repository-resolver-impl';
import type { RepositoryConfigReadResult } from './config/repository-config-reader';
import type { RepositoryValidator } from './repository-validator';
import { RepositoryResolutionError } from '../services/repository-resolver';

describe('createRepositoryResolver', () => {
  const validReadConfig = async (): Promise<RepositoryConfigReadResult> => ({
    config: {
      repositories: [
        { id: 'repo-1', path: '/path/to/repo1' },
        { id: 'repo-2', path: '/path/to/repo2' },
      ],
    },
    status: 'found',
  });

  const missingReadConfig = async (): Promise<RepositoryConfigReadResult> => ({
    configPath: '/missing/config.json',
    status: 'missing',
  });

  const invalidReadConfig = async (): Promise<RepositoryConfigReadResult> => ({
    configPath: '/invalid/config.json',
    error: 'Syntax error',
    status: 'invalid',
  });

  const duplicateReadConfig = async (): Promise<RepositoryConfigReadResult> => ({
    config: {
      repositories: [
        { id: 'dup-repo', path: '/path/1' },
        { id: 'dup-repo', path: '/path/2' },
      ],
    },
    status: 'found',
  });

  // repo-2 is treated as an invalid repository (e.g. path does not point to a Git repo)
  const mockValidator: RepositoryValidator = async (repo) => {
    if (repo.id === 'repo-2') {
      return { isValid: false, error: 'Not a git repo' };
    }
    return { isValid: true };
  };

  describe('resolve', () => {
    it('returns the repository descriptor for a configured repoId', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When
      const repo = await resolver.resolve('repo-1');

      // Then
      expect(repo).toEqual({ id: 'repo-1', path: '/path/to/repo1' });
    });

    it('throws RepositoryResolutionError when repoId is empty', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolve('')).rejects.toThrow(RepositoryResolutionError);
      await expect(resolver.resolve('')).rejects.toThrow('Repository id is required.');
    });

    it('throws RepositoryResolutionError when repoId is not in the registry', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolve('unknown-repo')).rejects.toThrow(RepositoryResolutionError);
      await expect(resolver.resolve('unknown-repo')).rejects.toThrow(
        'Repository id "unknown-repo" is not configured.',
      );
    });

    it('throws RepositoryResolutionError when config file does not exist', async () => {
      // Given
      const resolver = createRepositoryResolver(missingReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolve('repo-1')).rejects.toThrow(RepositoryResolutionError);
      await expect(resolver.resolve('repo-1')).rejects.toThrow(
        'Repository config is missing: /missing/config.json',
      );
    });

    it('throws RepositoryResolutionError when config file cannot be parsed', async () => {
      // Given
      const resolver = createRepositoryResolver(invalidReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolve('repo-1')).rejects.toThrow(RepositoryResolutionError);
      await expect(resolver.resolve('repo-1')).rejects.toThrow(
        'Repository config is invalid: Syntax error',
      );
    });

    it('throws RepositoryResolutionError when the registry has duplicated ids', async () => {
      // Given: config contains two entries with the same id, making registry construction fail
      const resolver = createRepositoryResolver(duplicateReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolve('dup-repo')).rejects.toThrow(RepositoryResolutionError);
      await expect(resolver.resolve('dup-repo')).rejects.toThrow(
        'Repository id "dup-repo" is duplicated.',
      );
    });
  });

  describe('resolveItem', () => {
    it('returns a valid RepositoryListItem including validation result', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When
      const item = await resolver.resolveItem('repo-1');

      // Then
      expect(item).toEqual({
        id: 'repo-1',
        name: 'repo1',
        path: '/path/to/repo1',
        isValid: true,
        error: undefined,
      });
    });

    it('returns an invalid RepositoryListItem when the validator rejects the path', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When
      const item = await resolver.resolveItem('repo-2');

      // Then
      expect(item).toEqual({
        id: 'repo-2',
        name: 'repo2',
        path: '/path/to/repo2',
        isValid: false,
        error: 'Not a git repo',
      });
    });

    it('throws RepositoryResolutionError when config file does not exist', async () => {
      // Given
      const resolver = createRepositoryResolver(missingReadConfig, mockValidator);

      // When / Then
      // resolveItem delegates to resolve first, so config errors surface here too
      await expect(resolver.resolveItem('repo-1')).rejects.toThrow(RepositoryResolutionError);
    });
  });

  describe('list', () => {
    it('returns all repositories with their individual validation results', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When
      const result = await resolver.list();

      // Then
      expect(result).toEqual({
        config: { status: 'found' },
        repositories: [
          {
            id: 'repo-1',
            name: 'repo1',
            path: '/path/to/repo1',
            isValid: true,
            error: undefined,
          },
          {
            id: 'repo-2',
            name: 'repo2',
            path: '/path/to/repo2',
            isValid: false,
            error: 'Not a git repo',
          },
        ],
      });
    });

    it('returns missing config status with an empty repository list', async () => {
      // Given
      const resolver = createRepositoryResolver(missingReadConfig, mockValidator);

      // When
      const result = await resolver.list();

      // Then
      expect(result).toEqual({
        config: { status: 'missing', path: '/missing/config.json' },
        repositories: [],
      });
    });

    it('returns invalid config status with an empty repository list', async () => {
      // Given
      const resolver = createRepositoryResolver(invalidReadConfig, mockValidator);

      // When
      const result = await resolver.list();

      // Then
      expect(result).toEqual({
        config: { status: 'invalid', error: 'Syntax error' },
        repositories: [],
      });
    });

    it('returns invalid config status when the registry rejects duplicated ids', async () => {
      // Given: config has two entries sharing the same id; registry construction will fail
      const resolver = createRepositoryResolver(duplicateReadConfig, mockValidator);

      // When
      const result = await resolver.list();

      // Then
      expect(result).toEqual({
        config: { status: 'invalid', error: 'Repository id "dup-repo" is duplicated.' },
        repositories: [],
      });
    });
  });
});
