import { describe, expect, it } from 'vitest';
import {
  getErrorMessage,
  resolveScopedRepository,
  ScopedRepositoryResolutionError,
} from './scoped-resolution';

describe('resolveScopedRepository', () => {
  it('resolves a configured repository', () => {
    // Given
    const configResult = {
      config: {
        repositories: [
          { id: 'sift', path: '/repo/sift' },
          { id: 'my-app', path: '/repo/my-app' },
        ],
      },
      status: 'found' as const,
    };

    // When
    const repository = resolveScopedRepository(configResult, 'my-app');

    // Then
    expect(repository).toEqual({ id: 'my-app', path: '/repo/my-app' });
  });

  it('fails when repoId is missing', () => {
    // Given
    const configResult = {
      config: {
        repositories: [{ id: 'sift', path: '/repo/sift' }],
      },
      status: 'found' as const,
    };

    // When / Then
    expect(() => resolveScopedRepository(configResult, undefined)).toThrow(
      ScopedRepositoryResolutionError,
    );
    expect(() => resolveScopedRepository(configResult, undefined)).toThrow(
      'Repository id is required.',
    );
  });

  it('fails when config is missing', () => {
    // Given
    const configResult = {
      configPath: '/missing/config.json',
      status: 'missing' as const,
    };

    // When / Then
    expect(() => resolveScopedRepository(configResult, 'sift')).toThrow(
      'Repository config is missing: /missing/config.json',
    );
  });

  it('wraps registry errors as scoped resolution errors', () => {
    // Given
    const configResult = {
      config: {
        repositories: [{ id: 'sift', path: '/repo/sift' }],
      },
      status: 'found' as const,
    };

    // When / Then
    expect(() => resolveScopedRepository(configResult, 'missing')).toThrow(
      ScopedRepositoryResolutionError,
    );
    expect(() => resolveScopedRepository(configResult, 'missing')).toThrow(
      'Repository id "missing" is not configured.',
    );
  });
});

describe('getErrorMessage', () => {
  it('returns Error messages and stringifies unknown values', () => {
    // Given / When / Then
    expect(getErrorMessage(new Error('failed'))).toBe('failed');
    expect(getErrorMessage('plain failure')).toBe('plain failure');
  });
});
