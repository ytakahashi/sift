import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitMetadataWatchTargets } from './git-metadata-watch-targets';
import { createRepoIgnoreMatcher } from './repo-ignore-matcher';

const { execFileSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock,
}));

const standardLayoutTargets: GitMetadataWatchTargets = {
  files: ['/repo/root/.git/index', '/repo/root/.git/HEAD', '/repo/root/.git/packed-refs'],
  directories: ['/repo/root/.git'],
  gitDirectories: ['/repo/root/.git'],
  refsDirectory: '/repo/root/.git/refs',
};

describe('createRepoIgnoreMatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    execFileSyncMock.mockImplementation((_file: string, args: string[]) => {
      const command = args.join(' ');

      if (command === 'ls-files --others --ignored --exclude-standard --directory -z') {
        return ['ignored/', 'ignored-file.log', ''].join('\0');
      }

      throw new Error(`Unexpected command: ${command}`);
    });
  });

  it('ignores gitignored repository files', () => {
    // Given: a matcher for one repository
    const matcher = createRepoIgnoreMatcher('/repo/root', standardLayoutTargets);

    // When / Then: gitignored files are filtered out
    expect(matcher('/repo/root/ignored/file.ts')).toBe(true);
    expect(matcher('/repo/root/ignored-file.log')).toBe(true);
  });

  it('keeps tracked repository files watchable', () => {
    // Given: a matcher for one repository
    const matcher = createRepoIgnoreMatcher('/repo/root', standardLayoutTargets);

    // When / Then: tracked files are not ignored
    expect(matcher('/repo/root/src/file.ts')).toBe(false);
  });

  it('keeps explicitly watched git metadata paths watchable', () => {
    // Given: a matcher with allowed .git paths
    const matcher = createRepoIgnoreMatcher('/repo/root', standardLayoutTargets);

    // When / Then: watched git metadata is not ignored
    expect(matcher('/repo/root')).toBe(false);
    expect(matcher('/repo/root/.git')).toBe(false);
    expect(matcher('/repo/root/.git/index')).toBe(false);
    expect(matcher('/repo/root/.git/HEAD')).toBe(false);
    expect(matcher('/repo/root/.git/packed-refs')).toBe(false);
    expect(matcher('/repo/root/.git/refs')).toBe(false);
    expect(matcher('/repo/root/.git/refs/heads/main')).toBe(false);
  });

  it('ignores other Git metadata internals', () => {
    // Given: a matcher watching the .git directory itself
    const matcher = createRepoIgnoreMatcher('/repo/root', standardLayoutTargets);

    // When / Then: descendants other than metadata files and refs are ignored,
    // including a sibling whose name merely starts with "refs"
    expect(matcher('/repo/root/.git/objects/ab/1234')).toBe(true);
    expect(matcher('/repo/root/.git/index.lock')).toBe(true);
    expect(matcher('/repo/root/.git/logs/HEAD')).toBe(true);
    expect(matcher('/repo/root/.git/worktrees/other/index')).toBe(true);
    expect(matcher('/repo/root/.git/refs-backup/main')).toBe(true);
  });

  it('filters shared Git internals outside a linked worktree', () => {
    // Given: worktree metadata and shared refs live outside the repository root
    const matcher = createRepoIgnoreMatcher('/linked', {
      files: [
        '/common/.git/worktrees/feature/index',
        '/common/.git/worktrees/feature/HEAD',
        '/common/.git/packed-refs',
      ],
      directories: ['/common/.git/worktrees/feature', '/common/.git'],
      gitDirectories: ['/common/.git/worktrees/feature', '/common/.git'],
      refsDirectory: '/common/.git/refs',
    });

    // When / Then: exact metadata directories and relevant descendants stay watchable
    for (const target of [
      '/common/.git',
      '/common/.git/worktrees/feature',
      '/common/.git/worktrees/feature/index',
      '/common/.git/worktrees/feature/HEAD',
      '/common/.git/packed-refs',
      '/common/.git/refs/heads/main',
    ]) {
      expect(matcher(target), target).toBe(false);
    }

    // When / Then: other shared metadata is excluded before allowing external paths
    for (const target of [
      '/common/.git/objects/ab/1234',
      '/common/.git/index',
      '/common/.git/logs/HEAD',
      '/common/.git/worktrees/feature/index.lock',
      '/common/.git/worktrees/other',
    ]) {
      expect(matcher(target), target).toBe(true);
    }
    expect(matcher('/linked/src/file.ts')).toBe(false);
    expect(matcher('/external/file.ts')).toBe(false);
  });

  it('keeps worktree files watchable when GIT_INDEX_FILE points inside the repository', () => {
    // Given: GIT_INDEX_FILE=/repo/root/custom-index makes repoRoot a metadata directory
    const matcher = createRepoIgnoreMatcher('/repo/root', {
      files: ['/repo/root/custom-index', '/repo/root/.git/HEAD', '/repo/root/.git/packed-refs'],
      directories: ['/repo/root', '/repo/root/.git'],
      gitDirectories: ['/repo/root/.git'],
      refsDirectory: '/repo/root/.git/refs',
    });

    // When / Then: the custom index and ordinary worktree files stay watchable,
    // while gitignored files and Git internals keep their usual handling
    expect(matcher('/repo/root/custom-index')).toBe(false);
    expect(matcher('/repo/root/src/file.ts')).toBe(false);
    expect(matcher('/repo/root/ignored/file.ts')).toBe(true);
    expect(matcher('/repo/root/.git/objects/ab/1234')).toBe(true);
  });

  it('watches only the custom index in a GIT_INDEX_FILE directory outside the repository', () => {
    // Given: GIT_INDEX_FILE=/tmp/custom/index places the index outside repoRoot
    const matcher = createRepoIgnoreMatcher('/repo/root', {
      files: ['/tmp/custom/index', '/repo/root/.git/HEAD', '/repo/root/.git/packed-refs'],
      directories: ['/tmp/custom', '/repo/root/.git'],
      gitDirectories: ['/repo/root/.git'],
      refsDirectory: '/repo/root/.git/refs',
    });

    // When / Then: the directory and index are watched, but unrelated siblings are not
    expect(matcher('/tmp/custom')).toBe(false);
    expect(matcher('/tmp/custom/index')).toBe(false);
    expect(matcher('/tmp/custom/other')).toBe(true);
    expect(matcher('/tmp/custom/nested/file')).toBe(true);
  });

  it('loads gitignored paths once during matcher creation', () => {
    // Given: a matcher with one tracked file path
    const matcher = createRepoIgnoreMatcher('/repo/root', standardLayoutTargets);

    // When: the same path is queried twice
    expect(matcher('/repo/root/src/file.ts')).toBe(false);
    expect(matcher('/repo/root/src/file.ts')).toBe(false);

    // Then: Git is queried once for ignored paths, not once per path evaluated
    // by chokidar.
    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
  });

  it('keeps watching when ignored path listing fails unexpectedly', () => {
    // Given: a matcher where Git cannot list ignored paths
    execFileSyncMock.mockImplementation((_file: string, args: string[]) => {
      const command = args.join(' ');
      if (command === 'ls-files --others --ignored --exclude-standard --directory -z') {
        throw new Error('git failed');
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const matcher = createRepoIgnoreMatcher('/repo/root', standardLayoutTargets);

    // When / Then: the path falls back to "not ignored" instead of throwing
    expect(matcher('/repo/root/ignored/file.ts')).toBe(false);
  });
});
