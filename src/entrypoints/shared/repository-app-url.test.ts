import { describe, it, expect } from 'vitest';
import { buildRepositoryAppUrl, parseRepositoryIdFromAppUrl } from './repository-app-url';

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
