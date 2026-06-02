import { describe, expect, it } from 'vitest';
import { buildRepositoryPath } from './repository-route';

describe('buildRepositoryPath', () => {
  it('builds repository paths with URL-safe ids', () => {
    // Given / When / Then
    expect(buildRepositoryPath('my app')).toBe('/repos/my%20app');
  });
});
