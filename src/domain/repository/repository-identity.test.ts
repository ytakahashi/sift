import { describe, expect, it } from 'vitest';
import {
  deriveRepositoryId,
  deriveRepositoryName,
  hashRepositoryPath,
  slugifyRepositoryName,
} from './repository-identity';

describe('deriveRepositoryName', () => {
  it('returns the last path segment', () => {
    // Given / When / Then
    expect(deriveRepositoryName('/repo/sift')).toBe('sift');
    expect(deriveRepositoryName('/Users/example/projects/my-app')).toBe('my-app');
  });

  it('trims trailing slashes before extracting the segment', () => {
    // Given / When / Then
    expect(deriveRepositoryName('/repo/sift/')).toBe('sift');
    expect(deriveRepositoryName('/repo/sift///')).toBe('sift');
  });

  it('falls back to the full path when no segment can be found', () => {
    // Given / When / Then — root path has no meaningful segment after splitting
    expect(deriveRepositoryName('/')).toBe('/');
  });
});

describe('slugifyRepositoryName', () => {
  it('normalizes repository directory names into URL-safe slugs', () => {
    // Given / When / Then
    expect(slugifyRepositoryName('My App')).toBe('my-app');
    expect(slugifyRepositoryName('__Sift!!')).toBe('sift');
  });

  it('falls back to "repository" when no alphanumeric characters remain', () => {
    // Given / When / Then
    expect(slugifyRepositoryName('!!!')).toBe('repository');
  });
});

describe('hashRepositoryPath', () => {
  it('produces a deterministic hash for the same input', () => {
    // Given
    const path = '/repo/sift';

    // When
    const hash1 = hashRepositoryPath(path);
    const hash2 = hashRepositoryPath(path);

    // Then
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different paths', () => {
    // Given / When
    const hashA = hashRepositoryPath('/repo/alpha');
    const hashB = hashRepositoryPath('/repo/beta');

    // Then
    expect(hashA).not.toBe(hashB);
  });
});

describe('deriveRepositoryId', () => {
  it('produces a slug-fingerprint format', () => {
    // Given / When
    const id = deriveRepositoryId('/repo/sift');

    // Then — format: <slug>-<fingerprint>, fingerprint is up to 10 chars
    expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    expect(id.startsWith('sift-')).toBe(true);
  });

  it('produces a deterministic ID for the same path', () => {
    // Given / When — calling deriveRepositoryId multiple times with the same
    // path always returns the same ID, confirming the result depends only on
    // the path string itself.
    const id1 = deriveRepositoryId('/repo/my-app');
    const id2 = deriveRepositoryId('/repo/my-app');

    // Then
    expect(id1).toBe(id2);
  });

  it('produces IDs that do not depend on surrounding repository context', () => {
    // Given — two different "config scenarios" where the same path appears
    // alongside different sibling paths in different order
    const scenarioA = ['/repo/alpha', '/repo/beta', '/repo/gamma'].map(deriveRepositoryId);
    const scenarioB = ['/repo/gamma', '/repo/alpha'].map(deriveRepositoryId);

    // When / Then — the ID for /repo/alpha is the same in both scenarios,
    // regardless of which other paths are present or what position it holds
    const alphaIdInA = scenarioA[0];
    const alphaIdInB = scenarioB[1];
    expect(alphaIdInA).toBe(alphaIdInB);

    // The ID for /repo/gamma is also the same across scenarios
    const gammaIdInA = scenarioA[2];
    const gammaIdInB = scenarioB[0];
    expect(gammaIdInA).toBe(gammaIdInB);
  });

  it('produces different IDs for different paths with the same directory name', () => {
    // Given — two repositories named "app" at different locations
    const id1 = deriveRepositoryId('/workspace/alpha/app');
    const id2 = deriveRepositoryId('/workspace/beta/app');

    // Then — both start with "app-" but have different fingerprints
    expect(id1.startsWith('app-')).toBe(true);
    expect(id2.startsWith('app-')).toBe(true);
    expect(id1).not.toBe(id2);
  });

  it('handles paths with special characters in directory names', () => {
    // Given / When
    const id = deriveRepositoryId('/repo/My Cool App!!');

    // Then — slug portion should be cleaned
    expect(id).toMatch(/^my-cool-app-[a-z0-9]+$/);
  });
});
