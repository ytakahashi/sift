import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { WorktreeFileGenerationProvider } from './worktree-file-generation-provider';

interface StatsFixture {
  isFile(): boolean;
  isSymbolicLink(): boolean;
  mode: number;
}

function regularFileStats(mode = 0o100644): StatsFixture {
  return { isFile: () => true, isSymbolicLink: () => false, mode };
}

function symlinkStats(): StatsFixture {
  return { isFile: () => false, isSymbolicLink: () => true, mode: 0o120000 };
}

function directoryStats(): StatsFixture {
  return { isFile: () => false, isSymbolicLink: () => false, mode: 0o040000 };
}

function missingEntryError(): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error('ENOENT: no such file or directory');
  error.code = 'ENOENT';
  return error;
}

describe('WorktreeFileGenerationProvider', () => {
  let hashObjects: Mock<(paths: string[]) => Promise<string[]>>;
  let lstat: Mock<(path: string) => Promise<StatsFixture>>;
  let readlink: Mock<(path: string) => Promise<string>>;
  let provider: WorktreeFileGenerationProvider;

  beforeEach(() => {
    hashObjects = vi.fn();
    lstat = vi.fn();
    readlink = vi.fn();
    provider = new WorktreeFileGenerationProvider('/repo/root', {
      git: { hashObjects },
      fileSystem: { lstat, readlink },
    });
  });

  it('hashes all regular files with a single batch call', async () => {
    // Given: two regular files (one executable) and one deleted path
    lstat.mockImplementation(async (path: string) => {
      if (path === '/repo/root/a.ts') return regularFileStats(0o100644);
      if (path === '/repo/root/bin/run') return regularFileStats(0o100755);
      throw missingEntryError();
    });
    hashObjects.mockResolvedValue(['blob-a', 'blob-run']);

    // When: generations are fetched for the three paths
    const generations = await provider.getWorktreeGenerations(['a.ts', 'bin/run', 'gone.ts']);

    // Then: exactly one subprocess batch runs, covering only the regular files
    expect(hashObjects).toHaveBeenCalledTimes(1);
    expect(hashObjects).toHaveBeenCalledWith(['a.ts', 'bin/run']);

    // Then: modes are normalized to Git's representation and deletion is detected
    expect(generations.get('a.ts')).toEqual({ kind: 'file', blobId: 'blob-a', mode: '100644' });
    expect(generations.get('bin/run')).toEqual({
      kind: 'file',
      blobId: 'blob-run',
      mode: '100755',
    });
    expect(generations.get('gone.ts')).toEqual({ kind: 'deleted' });
  });

  it('does not spawn the hash batch when no regular files are present', async () => {
    // Given: only a deleted path
    lstat.mockRejectedValue(missingEntryError());

    // When: generations are fetched
    await provider.getWorktreeGenerations(['gone.ts']);

    // Then: no subprocess is spawned
    expect(hashObjects).not.toHaveBeenCalled();
  });

  it('fingerprints symlinks by their target string', async () => {
    // Given: two symlinks with different targets and one duplicate target
    lstat.mockResolvedValue(symlinkStats());
    readlink.mockImplementation(async (path: string) =>
      path === '/repo/root/link-b' ? 'target-b' : 'target-a',
    );

    // When: generations are fetched
    const generations = await provider.getWorktreeGenerations(['link-a', 'link-b', 'link-a2']);

    // Then: equal targets share a fingerprint, different targets do not,
    // and the pointed-to file contents are never read
    const linkA = generations.get('link-a');
    const linkB = generations.get('link-b');
    const linkA2 = generations.get('link-a2');
    expect(linkA?.kind).toBe('symlink');
    expect(linkB?.kind).toBe('symlink');
    expect(linkA).toEqual(linkA2);
    expect(linkA).not.toEqual(linkB);
    expect(hashObjects).not.toHaveBeenCalled();
  });

  it('marks non-file, non-symlink worktree entries as unavailable', async () => {
    // Given: the path is a directory (e.g. a gitlink race after submodule
    // replacement)
    lstat.mockResolvedValue(directoryStats());

    // When: generations are fetched
    const generations = await provider.getWorktreeGenerations(['vendor/lib']);

    // Then: the entry is indeterminate, not deleted
    expect(generations.get('vendor/lib')).toEqual({
      kind: 'unavailable',
      reason: 'not a regular file or symlink',
    });
  });

  it('marks individual lstat and readlink failures as unavailable', async () => {
    // Given: lstat fails for one path (non-ENOENT) and readlink for another
    lstat.mockImplementation(async (path: string) => {
      if (path === '/repo/root/broken.ts') throw new Error('EACCES: permission denied');
      return symlinkStats();
    });
    readlink.mockRejectedValue(new Error('EIO: i/o error'));

    // When: generations are fetched
    const generations = await provider.getWorktreeGenerations(['broken.ts', 'link']);

    // Then: only the failing entries become unavailable, carrying the reason
    expect(generations.get('broken.ts')).toEqual({
      kind: 'unavailable',
      reason: 'EACCES: permission denied',
    });
    expect(generations.get('link')).toEqual({
      kind: 'unavailable',
      reason: 'EIO: i/o error',
    });
  });

  it('marks the whole batch unavailable when hash-object fails, discarding partial output', async () => {
    // Given: two regular files and one symlink; the hash batch fails
    lstat.mockImplementation(async (path: string) =>
      path === '/repo/root/link' ? symlinkStats() : regularFileStats(),
    );
    readlink.mockResolvedValue('target');
    hashObjects.mockRejectedValue(new Error('git hash-object returned 1 ids for 2 paths'));

    // When: generations are fetched
    const generations = await provider.getWorktreeGenerations(['a.ts', 'b.ts', 'link']);

    // Then: every regular file of the batch is unavailable (no partial adoption)
    // while entries classified without the batch are unaffected
    expect(generations.get('a.ts')?.kind).toBe('unavailable');
    expect(generations.get('b.ts')?.kind).toBe('unavailable');
    expect(generations.get('link')?.kind).toBe('symlink');
  });

  it('marks paths escaping the repository root as unavailable', async () => {
    // Given: a traversal path that resolveSafePath rejects
    // When: generations are fetched
    const generations = await provider.getWorktreeGenerations(['../outside.ts']);

    // Then: the entry is indeterminate and no fs access happens for it
    expect(generations.get('../outside.ts')?.kind).toBe('unavailable');
    expect(lstat).not.toHaveBeenCalled();
  });
});
