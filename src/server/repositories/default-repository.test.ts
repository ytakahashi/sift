import { describe, expect, it } from 'vitest';
import { createDefaultRepository, DEFAULT_REPO_ID } from './default-repository';

describe('createDefaultRepository', () => {
  it('wraps the current repository root with the temporary default id', () => {
    // Given
    const repoRoot = '/repo/root';

    // When
    const repository = createDefaultRepository(repoRoot);

    // Then
    expect(repository).toEqual({
      id: DEFAULT_REPO_ID,
      path: repoRoot,
    });
  });
});
