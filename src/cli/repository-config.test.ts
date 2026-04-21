import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addRepositoryConfigEntry,
  addRepositoryToConfig,
  createAvailableRepositoryId,
  RepositoryAlreadyRegisteredError,
  slugifyRepositoryId,
} from './repository-config';

describe('slugifyRepositoryId', () => {
  it('normalizes repository directory names into URL-safe ids', () => {
    // Given / When / Then
    expect(slugifyRepositoryId('My App')).toBe('my-app');
    expect(slugifyRepositoryId('__Sift!!')).toBe('sift');
    expect(slugifyRepositoryId('!!!')).toBe('repository');
  });
});

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
