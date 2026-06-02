import { describe, expect, it } from 'vitest';
import { parseAppRoute, parseRepositoryRoute } from './repository-route';

describe('repository-route', () => {
  it('parses the root repository selection route', () => {
    // Given / When / Then
    expect(parseAppRoute('/')).toEqual({ type: 'selection' });
  });

  it('parses repository routes', () => {
    // Given / When / Then
    expect(parseRepositoryRoute('/repos/sift')).toEqual({ repoId: 'sift', type: 'repository' });
    expect(parseRepositoryRoute('/repos/my-app/')).toEqual({
      repoId: 'my-app',
      type: 'repository',
    });
  });

  it('returns null for routes outside the repository viewer', () => {
    // Given / When / Then
    expect(parseRepositoryRoute('/repos')).toBeNull();
    expect(parseRepositoryRoute('/repos/sift/diff')).toBeNull();
  });
});
