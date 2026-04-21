import { describe, expect, it } from 'vitest';
import { createRepositoryRegistry, RepositoryRegistryError } from './repository-registry';

describe('createRepositoryRegistry', () => {
  it('lists configured repositories and resolves by id', () => {
    // Given
    const repositories = [
      { id: 'sift', path: '/repo/sift' },
      { id: 'my-app', path: '/repo/my-app' },
    ];

    // When
    const registry = createRepositoryRegistry(repositories);

    // Then
    expect(registry.list()).toEqual(repositories);
    expect(registry.resolve('my-app')).toEqual({ id: 'my-app', path: '/repo/my-app' });
  });

  it('fails when repository ids are duplicated', () => {
    // Given
    const repositories = [
      { id: 'sift', path: '/repo/sift' },
      { id: 'sift', path: '/repo/other' },
    ];

    // When / Then
    expect(() => createRepositoryRegistry(repositories)).toThrow(
      'Repository id "sift" is duplicated.',
    );
  });

  it('fails when repository id is not URL-safe', () => {
    // Given
    const repositories = [{ id: 'My App', path: '/repo/my-app' }];

    // When / Then
    expect(() => createRepositoryRegistry(repositories)).toThrow(RepositoryRegistryError);
  });

  it('fails when repository path is not absolute', () => {
    // Given
    const repositories = [{ id: 'sift', path: 'relative/sift' }];

    // When / Then
    expect(() => createRepositoryRegistry(repositories)).toThrow(
      'Repository path for "sift" must be absolute.',
    );
  });

  it('fails when resolving an unknown repository id', () => {
    // Given
    const registry = createRepositoryRegistry([{ id: 'sift', path: '/repo/sift' }]);

    // When / Then
    expect(() => registry.resolve('missing')).toThrow('Repository id "missing" is not configured.');
  });
});
