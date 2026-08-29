import { describe, expect, it } from 'vitest';
import { createDiffFileId } from './file-id';

describe('createDiffFileId', () => {
  it('preserves the repository-relative path in the diff identity', () => {
    // Given / When
    const id = createDiffFileId('src/nested/[literal].ts');

    // Then
    expect(id).toBe('file-src/nested/[literal].ts');
  });
});
