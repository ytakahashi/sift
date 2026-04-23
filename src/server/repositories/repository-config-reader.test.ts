import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPOSITORY_CONFIG_PATH,
  parseRepositoryConfig,
  readRepositoryConfig,
  RepositoryConfigParseError,
} from './repository-config-reader';

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

  it('uses config.json as the default config path', () => {
    // Given / When / Then
    expect(DEFAULT_REPOSITORY_CONFIG_PATH.endsWith('/.config/sift/config.json')).toBe(true);
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
    expect(config.repositories).toEqual([{ id: '__invalid_0', path: '' }]);
  });

  it('generates an invalid id when a repository id is missing', () => {
    // Given
    const rawConfig = JSON.stringify({ repositories: [{ path: '/repo/sift' }] });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config.repositories).toEqual([{ id: '__invalid_id_0', path: '/repo/sift' }]);
  });

  it('generates an empty path when a repository path is missing', () => {
    // Given
    const rawConfig = JSON.stringify({ repositories: [{ id: 'sift' }] });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config.repositories).toEqual([{ id: 'sift', path: '' }]);
  });

  it('returns a missing result when the config file does not exist', async () => {
    // Given
    const configPath = `/tmp/sift-missing-config-for-test-${Date.now()}.json`;

    // When
    const result = await readRepositoryConfig(configPath);

    // Then
    expect(result).toEqual({
      configPath,
      status: 'missing',
    });
  });

  it('returns an invalid result when reading the config throws non-ENOENT', async () => {
    // Given
    const rawConfig = '{ invalid JSON';
    const configPath = `/tmp/sift-invalid-config-for-test-${Date.now()}.json`;
    const { writeFile } = await import('node:fs/promises');
    await writeFile(configPath, rawConfig, 'utf8');

    // When
    const result = await readRepositoryConfig(configPath);

    // Then
    expect(result.status).toBe('invalid');
  });
});
