import { describe, expect, it } from 'vitest';
import { createRepositoryResolver } from './repository-resolver-impl';
import type { RepositoryConfigReadResult } from './config/repository-config-reader';
import type { RepositoryValidator } from './repository-validator';
import {
  RepositoryConfigResolutionError,
  RepositoryNotFoundError,
  RepositoryResolutionError,
  RepositoryValidationError,
} from '../services/repository-resolver';

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

  describe('resolveRepository', () => {
    it('returns a resolved repository when validation succeeds', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When
      const item = await resolver.resolveRepository('repo-1');

      // Then
      expect(item).toEqual({
        id: 'repo-1',
        name: 'repo1',
        path: '/path/to/repo1',
      });
    });

    it('throws RepositoryValidationError when the validator rejects the path', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolveRepository('repo-2')).rejects.toThrow(RepositoryValidationError);
      await expect(resolver.resolveRepository('repo-2')).rejects.toThrow('Not a git repo');
    });

    it('throws RepositoryNotFoundError when repoId is not in the registry', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolveRepository('unknown-repo')).rejects.toThrow(
        RepositoryNotFoundError,
      );
      await expect(resolver.resolveRepository('unknown-repo')).rejects.toThrow(
        'Repository id "unknown-repo" is not configured.',
      );
    });

    it('throws RepositoryConfigResolutionError when config file does not exist', async () => {
      // Given
      const resolver = createRepositoryResolver(missingReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolveRepository('repo-1')).rejects.toThrow(
        RepositoryConfigResolutionError,
      );
      await expect(resolver.resolveRepository('repo-1')).rejects.toMatchObject({
        kind: 'missing',
        message: 'Repository config is missing: /missing/config.json',
      });
    });

    it('throws RepositoryConfigResolutionError when config file cannot be parsed', async () => {
      // Given
      const resolver = createRepositoryResolver(invalidReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolveRepository('repo-1')).rejects.toThrow(
        RepositoryConfigResolutionError,
      );
      await expect(resolver.resolveRepository('repo-1')).rejects.toMatchObject({
        kind: 'invalid',
        message: 'Repository config is invalid: Syntax error',
      });
    });

    it('throws RepositoryConfigResolutionError when the registry has duplicated ids', async () => {
      // Given: config contains two entries with the same id, making registry construction fail
      const resolver = createRepositoryResolver(duplicateReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolveRepository('dup-repo')).rejects.toThrow(
        RepositoryConfigResolutionError,
      );
      await expect(resolver.resolveRepository('dup-repo')).rejects.toMatchObject({
        kind: 'invalid',
        message: 'Repository id "dup-repo" is duplicated.',
      });
    });
  });

  describe('list', () => {
    it('returns valid repositories and invalid repositories separately', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When
      const result = await resolver.list();

      // Then
      expect(result).toEqual({
        repositories: [
          {
            id: 'repo-1',
            name: 'repo1',
            path: '/path/to/repo1',
          },
        ],
        invalidRepositories: [
          {
            id: 'repo-2',
            name: 'repo2',
            path: '/path/to/repo2',
            reason: 'Not a git repo',
          },
        ],
      });
    });

    it('throws when config file does not exist', async () => {
      // Given
      const resolver = createRepositoryResolver(missingReadConfig, mockValidator);

      // When / Then
      await expect(resolver.list()).rejects.toThrow(RepositoryConfigResolutionError);
      await expect(resolver.list()).rejects.toMatchObject({
        kind: 'missing',
        message: 'Repository config is missing: /missing/config.json',
      });
    });

    it('throws when config file cannot be parsed', async () => {
      // Given
      const resolver = createRepositoryResolver(invalidReadConfig, mockValidator);

      // When / Then
      await expect(resolver.list()).rejects.toThrow(RepositoryConfigResolutionError);
      await expect(resolver.list()).rejects.toMatchObject({
        kind: 'invalid',
        message: 'Syntax error',
      });
    });

    it('throws when the registry rejects duplicated ids', async () => {
      // Given: config has two entries sharing the same id; registry construction will fail
      const resolver = createRepositoryResolver(duplicateReadConfig, mockValidator);

      // When / Then
      await expect(resolver.list()).rejects.toThrow(RepositoryConfigResolutionError);
      await expect(resolver.list()).rejects.toMatchObject({
        kind: 'invalid',
        message: 'Repository id "dup-repo" is duplicated.',
      });
    });
  });
});
