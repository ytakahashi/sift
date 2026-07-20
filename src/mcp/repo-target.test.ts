import { describe, expect, it, vi } from 'vitest';
import { createRepoRootResolver } from './repo-target';

describe('createRepoRootResolver', () => {
  it('does not resolve the repo root until resolve() is called', () => {
    // Given
    const resolveRepoRoot = vi.fn().mockReturnValue('/repo/sift');

    // When
    createRepoRootResolver('/repo/sift', resolveRepoRoot);

    // Then
    expect(resolveRepoRoot).not.toHaveBeenCalled();
  });

  it('resolves the candidate path on the first call and caches the result', () => {
    // Given
    const resolveRepoRoot = vi.fn().mockReturnValue('/repo/sift');
    const resolver = createRepoRootResolver('/repo/sift/subdir', resolveRepoRoot);

    // When
    const first = resolver.resolve();
    const second = resolver.resolve();

    // Then
    expect(first).toBe('/repo/sift');
    expect(second).toBe('/repo/sift');
    expect(resolveRepoRoot).toHaveBeenCalledOnce();
    expect(resolveRepoRoot).toHaveBeenCalledWith('/repo/sift/subdir');
  });

  it('does not cache a failed resolution, so the next call retries', () => {
    // Given
    const resolveRepoRoot = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('not a git repository');
      })
      .mockReturnValueOnce('/repo/sift');
    const resolver = createRepoRootResolver('/repo/sift', resolveRepoRoot);

    // When
    expect(() => resolver.resolve()).toThrow('not a git repository');
    const second = resolver.resolve();

    // Then
    expect(second).toBe('/repo/sift');
    expect(resolveRepoRoot).toHaveBeenCalledTimes(2);
  });
});
