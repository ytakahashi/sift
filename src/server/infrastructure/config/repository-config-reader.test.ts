import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_REPOSITORY_CONFIG_PATH } from '../../../local-config/repository-config-path';
import { readRepositoryConfig } from './repository-config-reader';
import { readFile } from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('readRepositoryConfig', () => {
  it('uses config.json as the default config path', () => {
    // Given / When / Then
    expect(DEFAULT_REPOSITORY_CONFIG_PATH.endsWith('/.config/sift/config.json')).toBe(true);
  });
  it('returns a missing result when the config file does not exist', async () => {
    // Given
    const configPath = `/tmp/sift-missing-config-for-test-${Date.now()}.json`;
    vi.mocked(readFile).mockRejectedValueOnce(
      Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
    );

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
    const configPath = `/tmp/sift-invalid-config-for-test-${Date.now()}.json`;
    vi.mocked(readFile).mockRejectedValueOnce(new Error('Permission denied'));

    // When
    const result = await readRepositoryConfig(configPath);

    // Then
    expect(result.status).toBe('invalid');
  });
});
