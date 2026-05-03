import { describe, expect, it, vi } from 'vitest';
import {
  deriveRepositoryId,
  deriveRepositoryName,
} from '../../domain/repository/repository-identity';
import { createRepositoryResolver } from './repository-resolver-impl';
import type { RepositoryConfigReadResult } from './config/repository-config-reader';
import type { RepositoryValidator } from './repository-validator';
import {
  RepositoryConfigResolutionError,
  RepositoryNotFoundError,
  RepositoryValidationError,
} from '../services/repository-resolver';

vi.mock('./config/repository-config-store', () => ({
  normalizeConfiguredRepositoryPath: vi.fn((repositoryPath: string) => repositoryPath),
}));

describe('createRepositoryResolver', () => {
  // Pre-derive IDs for test paths so expected values stay in sync with the
  // runtime derivation logic.
  const repo1Id = deriveRepositoryId('/path/to/repo1');
  const repo2Id = deriveRepositoryId('/path/to/repo2');

  const validReadConfig = async (): Promise<RepositoryConfigReadResult> => ({
    config: {
      repositories: [{ path: '/path/to/repo1' }, { path: '/path/to/repo2' }],
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
      // Two entries with the same path produce the same derived ID → duplicate
      repositories: [{ path: '/path/dup-repo' }, { path: '/path/dup-repo' }],
    },
    status: 'found',
  });

  // repo2 is treated as an invalid repository (e.g. path does not point to a Git repo)
  const mockValidator: RepositoryValidator = async (repo) => {
    if (repo.id === repo2Id) {
      return { isValid: false, error: 'Not a git repo' };
    }
    return { isValid: true };
  };

  describe('resolveRepository', () => {
    it('returns a resolved repository when validation succeeds', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When
      const item = await resolver.resolveRepository(repo1Id);

      // Then
      expect(item).toEqual({
        id: repo1Id,
        name: deriveRepositoryName('/path/to/repo1'),
        path: '/path/to/repo1',
      });
    });

    it('throws RepositoryValidationError when the validator rejects the path', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolveRepository(repo2Id)).rejects.toThrow(RepositoryValidationError);
      await expect(resolver.resolveRepository(repo2Id)).rejects.toThrow('Not a git repo');
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
      await expect(resolver.resolveRepository(repo1Id)).rejects.toThrow(
        RepositoryConfigResolutionError,
      );
      await expect(resolver.resolveRepository(repo1Id)).rejects.toMatchObject({
        kind: 'missing',
        message: 'Repository config is missing: /missing/config.json',
      });
    });

    it('throws RepositoryConfigResolutionError when config file cannot be parsed', async () => {
      // Given
      const resolver = createRepositoryResolver(invalidReadConfig, mockValidator);

      // When / Then
      await expect(resolver.resolveRepository(repo1Id)).rejects.toThrow(
        RepositoryConfigResolutionError,
      );
      await expect(resolver.resolveRepository(repo1Id)).rejects.toMatchObject({
        kind: 'invalid',
        message: 'Repository config is invalid: Syntax error',
      });
    });

    it('throws RepositoryConfigResolutionError when the registry has duplicated ids', async () => {
      // Given: config contains two entries with the same path, producing the same derived ID
      const resolver = createRepositoryResolver(duplicateReadConfig, mockValidator);
      const dupId = deriveRepositoryId('/path/dup-repo');

      // When / Then
      await expect(resolver.resolveRepository(dupId)).rejects.toThrow(
        RepositoryConfigResolutionError,
      );
      await expect(resolver.resolveRepository(dupId)).rejects.toMatchObject({
        kind: 'invalid',
        message: `Repository id "${dupId}" is duplicated.`,
      });
    });
  });

  describe('listRepositories', () => {
    it('returns valid repositories and invalid repositories separately', async () => {
      // Given
      const resolver = createRepositoryResolver(validReadConfig, mockValidator);

      // When
      const result = await resolver.listRepositories();

      // Then
      expect(result).toEqual({
        repositories: [
          {
            id: repo1Id,
            name: deriveRepositoryName('/path/to/repo1'),
            path: '/path/to/repo1',
          },
        ],
        invalidRepositories: [
          {
            id: repo2Id,
            name: deriveRepositoryName('/path/to/repo2'),
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
      await expect(resolver.listRepositories()).rejects.toThrow(RepositoryConfigResolutionError);
      await expect(resolver.listRepositories()).rejects.toMatchObject({
        kind: 'missing',
        message: 'Repository config is missing: /missing/config.json',
      });
    });

    it('throws when config file cannot be parsed', async () => {
      // Given
      const resolver = createRepositoryResolver(invalidReadConfig, mockValidator);

      // When / Then
      await expect(resolver.listRepositories()).rejects.toThrow(RepositoryConfigResolutionError);
      await expect(resolver.listRepositories()).rejects.toMatchObject({
        kind: 'invalid',
        message: 'Syntax error',
      });
    });

    it('throws when the registry rejects duplicated ids', async () => {
      // Given: config has two entries with the same path; derived IDs will collide
      const resolver = createRepositoryResolver(duplicateReadConfig, mockValidator);
      const dupId = deriveRepositoryId('/path/dup-repo');

      // When / Then
      await expect(resolver.listRepositories()).rejects.toThrow(RepositoryConfigResolutionError);
      await expect(resolver.listRepositories()).rejects.toMatchObject({
        kind: 'invalid',
        message: `Repository id "${dupId}" is duplicated.`,
      });
    });
  });
});
