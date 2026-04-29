import { describe, expect, it } from 'vitest';
import {
  addRepositoryToConfig,
  createAvailableRepositoryId,
  RepositoryAlreadyRegisteredError,
  slugifyRepositoryId,
} from './repository-config-update';

describe('slugifyRepositoryId', () => {
  it('normalizes repository directory names into URL-safe ids', () => {
    // Given / When / Then
    expect(slugifyRepositoryId('My App')).toBe('my-app');
    expect(slugifyRepositoryId('__Sift!!')).toBe('sift');
    expect(slugifyRepositoryId('!!!')).toBe('repository');
  });
});

describe('createAvailableRepositoryId', () => {
  it('uses the candidate when it is available', () => {
    // Given / When / Then
    expect(createAvailableRepositoryId('sift', [])).toBe('sift');
  });

  it('appends the first available numeric suffix', () => {
    // Given
    const repositories = [
      { id: 'sift', path: '/repo/sift' },
      { id: 'sift-2', path: '/repo/other-sift' },
    ];

    // When / Then
    expect(createAvailableRepositoryId('sift', repositories)).toBe('sift-3');
  });
});

describe('addRepositoryToConfig', () => {
  it('adds a repository with a stable generated id', () => {
    // Given
    const config = {
      repositories: [{ id: 'sift', path: '/repo/sift' }],
    };

    // When
    const result = addRepositoryToConfig(config, '/repo/My App');

    // Then
    expect(result.repository).toEqual({
      id: 'my-app',
      path: '/repo/My App',
    });
    expect(result.config.repositories).toEqual([
      { id: 'sift', path: '/repo/sift' },
      { id: 'my-app', path: '/repo/My App' },
    ]);
  });

  it('chooses a suffixed id when the directory name already exists', () => {
    // Given
    const config = {
      repositories: [{ id: 'my-app', path: '/repo/existing' }],
    };

    // When
    const result = addRepositoryToConfig(config, '/repo/my-app');

    // Then
    expect(result.repository.id).toBe('my-app-2');
  });

  it('fails when the repository path is already registered', () => {
    // Given
    const config = {
      repositories: [{ id: 'my-app', path: '/repo/my-app' }],
    };

    // When / Then
    expect(() => addRepositoryToConfig(config, '/repo/my-app')).toThrow(
      RepositoryAlreadyRegisteredError,
    );
  });
});
