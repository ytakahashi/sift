import { describe, expect, it } from 'vitest';
import { buildRepositoryPath, parseRepositoryRoute } from './repository-route';

describe('repository-route', () => {
  it('parses repository routes', () => {
    // Given / When / Then
    expect(parseRepositoryRoute('/repos/sift')).toEqual({ repoId: 'sift' });
    expect(parseRepositoryRoute('/repos/my-app/')).toEqual({ repoId: 'my-app' });
  });

  it('returns null for routes outside the repository viewer', () => {
    // Given / When / Then
    expect(parseRepositoryRoute('/')).toBeNull();
    expect(parseRepositoryRoute('/repos')).toBeNull();
    expect(parseRepositoryRoute('/repos/sift/diff')).toBeNull();
  });

  it('builds repository paths with URL-safe ids', () => {
    // Given / When / Then
    expect(buildRepositoryPath('my app')).toBe('/repos/my%20app');
  });
});
