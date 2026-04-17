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

      if (command === 'ls-files --others --ignored --exclude-standard --directory -z') {
        return ['ignored/', 'ignored-file.log', ''].join('\0');
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
    expect(matcher('/repo/root/ignored-file.log')).toBe(true);
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

  it('loads gitignored paths once during matcher creation', () => {
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

    // Then: Git is queried once for .git location and once for ignored paths,
    // not once per path evaluated by chokidar.
    expect(execFileSyncMock).toHaveBeenCalledTimes(2);
  });

  it('keeps watching when ignored path listing fails unexpectedly', () => {
    // Given: a matcher where Git cannot list ignored paths
    execFileSyncMock.mockImplementation((_file: string, args: string[]) => {
      const command = args.join(' ');
      if (command === 'rev-parse --git-path .') {
        return '.git\n';
      }
      if (command === 'ls-files --others --ignored --exclude-standard --directory -z') {
        throw new Error('git failed');
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const matcher = createRepoIgnoreMatcher('/repo/root', [
      '/repo/root',
      '/repo/root/.git/index',
      '/repo/root/.git/HEAD',
      '/repo/root/.git/refs',
      '/repo/root/.git/packed-refs',
    ]);

    // When / Then: the path falls back to "not ignored" instead of throwing
    expect(matcher('/repo/root/ignored/file.ts')).toBe(false);
  });
});
