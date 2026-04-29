import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addRepositoryConfigEntry } from './repository-config-store';

describe('addRepositoryConfigEntry', () => {
  it('creates a config file when it does not exist', async () => {
    // Given
    const tempDir = await mkdtemp(path.join(tmpdir(), 'sift-config-test-'));
    const configPath = path.join(tempDir, 'nested', 'config.json');

    // When
    const repository = await addRepositoryConfigEntry('/repo/my-app', configPath);

    // Then
    expect(repository).toEqual({ id: 'my-app', path: '/repo/my-app' });
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
      repositories: [{ id: 'my-app', path: '/repo/my-app' }],
    });
  });

  it('fails instead of replacing malformed existing config', async () => {
    // Given
    const tempDir = await mkdtemp(path.join(tmpdir(), 'sift-config-test-'));
    const configPath = path.join(tempDir, 'config.json');
    await writeFile(configPath, '{ "repositories": [', 'utf8');

    // When / Then
    await expect(addRepositoryConfigEntry('/repo/my-app', configPath)).rejects.toThrow(
      'Invalid JSON config',
    );
  });
});
