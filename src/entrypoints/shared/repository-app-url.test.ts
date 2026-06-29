import { describe, it, expect } from 'vitest';
import {
  buildRepositoryAppUrl,
  findRepositoryIdFromArgv,
  parseRepositoryIdFromAppUrl,
} from './repository-app-url';

describe('buildRepositoryAppUrl', () => {
  it('should build a sift://repos/<id> URL for a repository id', () => {
    // Given
    const repoId = 'sift-k4sq91x8';

    // When
    const url = buildRepositoryAppUrl(repoId);

    // Then
    expect(url).toBe('sift://repos/sift-k4sq91x8');
  });

  it('should percent-encode characters that are unsafe in a URL path', () => {
    // Given a (non-canonical) id containing characters that must be encoded
    const repoId = 'a b/c';

    // When
    const url = buildRepositoryAppUrl(repoId);

    // Then
    expect(url).toBe('sift://repos/a%20b%2Fc');
  });
});

describe('parseRepositoryIdFromAppUrl', () => {
  it('should extract the repository id from a sift://repos/<id> URL', () => {
    // When
    const repoId = parseRepositoryIdFromAppUrl('sift://repos/sift-k4sq91x8');

    // Then
    expect(repoId).toBe('sift-k4sq91x8');
  });

  it('should round-trip a percent-encoded id', () => {
    // Given a URL produced by buildRepositoryAppUrl
    const url = buildRepositoryAppUrl('a b/c');

    // When
    const repoId = parseRepositoryIdFromAppUrl(url);

    // Then
    expect(repoId).toBe('a b/c');
  });

  it('should return null for a URL with a different scheme', () => {
    // When
    const repoId = parseRepositoryIdFromAppUrl('https://repos/sift-k4sq91x8');

    // Then
    expect(repoId).toBeNull();
  });

  it('should return null for a sift URL without the repos host', () => {
    // When
    const repoId = parseRepositoryIdFromAppUrl('sift://other/sift-k4sq91x8');

    // Then
    expect(repoId).toBeNull();
  });

  it('should return null when the id segment is missing', () => {
    // When
    const repoId = parseRepositoryIdFromAppUrl('sift://repos/');

    // Then
    expect(repoId).toBeNull();
  });

  it('should return null for malformed percent-encoding', () => {
    // Given an invalid percent-escape that decodeURIComponent rejects
    // When
    const repoId = parseRepositoryIdFromAppUrl('sift://repos/%');

    // Then
    expect(repoId).toBeNull();
  });
});

describe('findRepositoryIdFromArgv', () => {
  it('should extract a repository id from a sift URL argument', () => {
    // Given
    const argv = ['Sift.app/Contents/MacOS/Sift', 'sift://repos/repo-a'];

    // When
    const repoId = findRepositoryIdFromArgv(argv);

    // Then
    expect(repoId).toBe('repo-a');
  });

  it('should use the last repository intent when multiple arguments match', () => {
    // Given: Electron can append platform arguments before or after app-specific ones.
    const argv = ['sift://repos/repo-a', '--irrelevant', 'sift://repos/repo-b'];

    // When
    const repoId = findRepositoryIdFromArgv(argv);

    // Then
    expect(repoId).toBe('repo-b');
  });

  it('should ignore malformed URLs and continue scanning earlier arguments', () => {
    // Given
    const argv = ['sift://repos/repo-a', 'sift://repos/%'];

    // When
    const repoId = findRepositoryIdFromArgv(argv);

    // Then
    expect(repoId).toBe('repo-a');
  });

  it('should support a repo-id argument for future launch paths', () => {
    // Given
    const argv = ['Sift.app/Contents/MacOS/Sift', '--repo-id=repo-a'];

    // When
    const repoId = findRepositoryIdFromArgv(argv);

    // Then
    expect(repoId).toBe('repo-a');
  });

  it('should return null when no repository intent is present', () => {
    // Given
    const argv = ['Sift.app/Contents/MacOS/Sift', '--flag'];

    // When
    const repoId = findRepositoryIdFromArgv(argv);

    // Then
    expect(repoId).toBeNull();
  });
});
