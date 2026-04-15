import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepoIgnoreMatcher } from './repo-ignore-matcher';

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
}));

describe('createRepoIgnoreMatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    execFileSyncMock.mockImplementation((_file: string, args: string[]) => {
      const command = args.join(' ');

      if (command === 'rev-parse --git-path .') {
        return '.git\n';
      }

      if (command === 'check-ignore --quiet -- ignored/file.ts') {
        return '';
      }

      if (command === 'check-ignore --quiet -- src/file.ts') {
        throw Object.assign(new Error('not ignored'), { status: 1 });
      }

      if (command === 'check-ignore --quiet -- broken/file.ts') {
        throw new Error('git failed');
      }

      throw new Error(`Unexpected command: ${command}`);
    });
  });

  it('ignores gitignored repository files', () => {
    // Given: a matcher for one repository
    const matcher = createRepoIgnoreMatcher('/repo/root', [
      '/repo/root',
      '/repo/root/.git/index',
      '/repo/root/.git/HEAD',
      '/repo/root/.git/refs',
      '/repo/root/.git/packed-refs',
    ]);

    // When / Then: gitignored files are filtered out
    expect(matcher('/repo/root/ignored/file.ts')).toBe(true);
  });

  it('keeps tracked repository files watchable', () => {
    // Given: a matcher for one repository
    const matcher = createRepoIgnoreMatcher('/repo/root', [
      '/repo/root',
      '/repo/root/.git/index',
      '/repo/root/.git/HEAD',
      '/repo/root/.git/refs',
      '/repo/root/.git/packed-refs',
    ]);

    // When / Then: tracked files are not ignored
    expect(matcher('/repo/root/src/file.ts')).toBe(false);
  });

  it('keeps explicitly watched git metadata paths watchable', () => {
    // Given: a matcher with allowed .git paths
    const matcher = createRepoIgnoreMatcher('/repo/root', [
      '/repo/root',
      '/repo/root/.git/index',
      '/repo/root/.git/HEAD',
      '/repo/root/.git/refs',
      '/repo/root/.git/packed-refs',
    ]);

    // When / Then: watched git metadata is not ignored
    expect(matcher('/repo/root/.git/refs/heads/main')).toBe(false);
  });

  it('caches gitignore lookups per relative path', () => {
    // Given: a matcher with one tracked file path
    const matcher = createRepoIgnoreMatcher('/repo/root', [
      '/repo/root',
      '/repo/root/.git/index',
      '/repo/root/.git/HEAD',
      '/repo/root/.git/refs',
      '/repo/root/.git/packed-refs',
    ]);

    // When: the same path is queried twice
    expect(matcher('/repo/root/src/file.ts')).toBe(false);
    expect(matcher('/repo/root/src/file.ts')).toBe(false);

    // Then: git check-ignore runs only once for that path
    expect(execFileSyncMock).toHaveBeenCalledTimes(2);
  });

  it('keeps watching when git check-ignore fails unexpectedly', () => {
    // Given: a matcher where git cannot answer for one path
    const matcher = createRepoIgnoreMatcher('/repo/root', [
      '/repo/root',
      '/repo/root/.git/index',
      '/repo/root/.git/HEAD',
      '/repo/root/.git/refs',
      '/repo/root/.git/packed-refs',
    ]);

    // When / Then: the path falls back to "not ignored" instead of throwing
    expect(matcher('/repo/root/broken/file.ts')).toBe(false);
  });
});
