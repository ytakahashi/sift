import { describe, expect, it } from 'vitest';
import {
  formatRepositoryConfig,
  parseRepositoryConfig,
  RepositoryConfigParseError,
} from './repository-config-schema';

describe('parseRepositoryConfig', () => {
  it('parses path-only repository entries from the JSON config', () => {
    // Given
    const rawConfig = JSON.stringify({
      repositories: [{ path: '/repo/sift' }, { path: '/repo/my-app' }],
    });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config).toEqual({
      repositories: [{ path: '/repo/sift' }, { path: '/repo/my-app' }],
    });
  });

  it('ignores the id field from old-format entries for backwards compatibility', () => {
    // Given — old format included both id and path
    const rawConfig = JSON.stringify({
      repositories: [
        { id: 'sift', path: '/repo/sift' },
        { id: 'my-app', path: '/repo/my-app' },
      ],
    });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then — only path is extracted
    expect(config).toEqual({
      repositories: [{ path: '/repo/sift' }, { path: '/repo/my-app' }],
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

  it('filters out repository entries that are not objects', () => {
    // Given
    const rawConfig = JSON.stringify({
      repositories: ['/path/to/repo'],
    });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config.repositories).toEqual([]);
  });

  it('filters out repository entries when the path field is missing or empty', () => {
    // Given
    const rawConfig = JSON.stringify({
      repositories: [{ id: 'old-id' }, { path: '' }, { path: '   ' }],
    });

    // When
    const config = parseRepositoryConfig(rawConfig);

    // Then
    expect(config.repositories).toEqual([]);
  });
});

describe('formatRepositoryConfig', () => {
  it('formats config as pretty-printed JSON with a trailing newline', () => {
    // Given
    const config = { repositories: [{ path: '/repo/sift' }] };

    // When
    const formatted = formatRepositoryConfig(config);

    // Then
    expect(formatted).toBe(
      '{\n  "repositories": [\n    {\n      "path": "/repo/sift"\n    }\n  ]\n}\n',
    );
  });
});
