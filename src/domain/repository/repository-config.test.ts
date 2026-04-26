import { describe, expect, it } from 'vitest';
import { parseRepositoryConfig, RepositoryConfigParseError } from './repository-config';

describe('parseRepositoryConfig', () => {
  it('parses repository ids and paths from the JSON config file', () => {
    // Given
    const rawConfig = JSON.stringify({
      repositories: [
        {
          id: 'sift',
          path: '/Users/example/projects/sift',
        },
        {
          id: 'my-app',
          path: '/Users/example/work/my app',
        },
      ],
    });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config).toEqual({
      repositories: [
        {
          id: 'sift',
          path: '/Users/example/projects/sift',
        },
        {
          id: 'my-app',
          path: '/Users/example/work/my app',
        },
      ],
    });
  });

  it('fails when the JSON cannot be parsed', () => {
    // Given
    const rawConfig = '{ "repositories": [';

    // When / Then
    expect(() => parseRepositoryConfig(rawConfig)).toThrow(RepositoryConfigParseError);
  });

  it('fails when the repositories key is missing', () => {
    // Given
    const rawConfig = JSON.stringify({ items: [] });

    // When / Then
    expect(() => parseRepositoryConfig(rawConfig)).toThrow(
      'Config must contain a "repositories" array.',
    );
  });

  it('generates an invalid id when a repository entry is not an object', () => {
    // Given
    const rawConfig = JSON.stringify({ repositories: ['sift'] });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config.repositories).toEqual([{ id: 'invalid-repo-0', path: '' }]);
  });

  it('generates an invalid id when a repository id is missing', () => {
    // Given
    const rawConfig = JSON.stringify({ repositories: [{ path: '/repo/sift' }] });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config.repositories).toEqual([{ id: 'invalid-id-0', path: '/repo/sift' }]);
  });

  it('generates an empty path when a repository path is missing', () => {
    // Given
    const rawConfig = JSON.stringify({ repositories: [{ id: 'sift' }] });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config.repositories).toEqual([{ id: 'sift', path: '' }]);
  });
});
