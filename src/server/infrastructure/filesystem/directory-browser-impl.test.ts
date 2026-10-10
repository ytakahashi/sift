import type { Dirent } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDirectoryBrowser } from './directory-browser-impl';

const io = vi.hoisted(() => ({ readdir: vi.fn(), stat: vi.fn(), homedir: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readdir: io.readdir, stat: io.stat }));
vi.mock('node:os', () => ({ homedir: io.homedir }));

function entry(
  name: string,
  kind: 'directory' | 'file' | 'link' = 'directory',
): Pick<Dirent, 'name' | 'isDirectory' | 'isSymbolicLink'> {
  return {
    name,
    isDirectory: () => kind === 'directory',
    isSymbolicLink: () => kind === 'link',
  };
}

function fsError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

describe('createDirectoryBrowser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    io.homedir.mockReturnValue('/home/user');
    io.readdir.mockResolvedValue([]);
    io.stat.mockRejectedValue(fsError('ENOENT'));
  });

  it('starts at the home directory when the path is omitted', async () => {
    // Given
    const browser = createDirectoryBrowser();

    // When
    const result = await browser.listDirectories(undefined, { showHidden: false });

    // Then
    expect(io.readdir).toHaveBeenCalledWith('/home/user', { withFileTypes: true });
    expect(result).toEqual({
      path: '/home/user',
      parentPath: '/home',
      isGitRepository: false,
      entries: [],
      truncated: false,
    });
  });

  it.each([
    ['/alias/child/../', '/alias', '/'],
    ['/', '/', null],
  ])('normalizes %s while preserving symbolic link spelling', async (input, normalized, parent) => {
    // Given
    const browser = createDirectoryBrowser();

    // When
    const result = await browser.listDirectories(input, { showHidden: false });

    // Then
    expect(result.path).toBe(normalized);
    expect(result.parentPath).toBe(parent);
    expect(io.homedir).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'Directory path must be an absolute path.'],
    ['relative/path', 'Directory path must be an absolute path.'],
    ['/invalid\0path', 'Directory path contains invalid characters.'],
  ])('rejects invalid path %j before I/O', async (input, message) => {
    // Given
    const browser = createDirectoryBrowser();

    // When
    const result = browser.listDirectories(input, { showHidden: false });

    // Then
    await expect(result).rejects.toMatchObject({ statusCode: 400, message });
    expect(io.readdir).not.toHaveBeenCalled();
    expect(io.stat).not.toHaveBeenCalled();
    expect(io.homedir).not.toHaveBeenCalled();
  });

  it('filters files and hidden folders and sorts directory names deterministically', async () => {
    // Given: equal lowercase names use their original spelling as a tie-breaker
    io.readdir.mockResolvedValue([
      entry('beta'),
      entry('alpha'),
      entry('Alpha'),
      entry('z.txt', 'file'),
      entry('.hidden'),
      entry('.git'),
    ]);

    // When
    const result = await createDirectoryBrowser().listDirectories('/parent', { showHidden: false });

    // Then
    expect(result.entries).toEqual(
      ['Alpha', 'alpha', 'beta'].map((name) => ({
        name,
        path: `/parent/${name}`,
        isGitRepository: false,
      })),
    );
    expect(io.stat.mock.calls.map(([p]) => p).sort()).toEqual([
      '/parent/.git',
      '/parent/Alpha/.git',
      '/parent/alpha/.git',
      '/parent/beta/.git',
    ]);
  });

  it('shows hidden directories on request but always excludes .git', async () => {
    // Given
    io.readdir.mockResolvedValue([entry('.hidden'), entry('.git', 'link')]);

    // When
    const result = await createDirectoryBrowser().listDirectories('/parent', { showHidden: true });

    // Then
    expect(result.entries.map(({ name }) => name)).toEqual(['.hidden']);
    expect(io.stat).not.toHaveBeenCalledWith('/parent/.git/.git');
  });

  it('follows directory links and skips file, broken, and inaccessible links', async () => {
    // Given
    io.readdir.mockResolvedValue(
      ['directory', 'file', 'broken', 'denied'].map((name) => entry(name, 'link')),
    );
    io.stat.mockImplementation(async (p: string) => {
      if (p === '/parent/directory') return { isDirectory: () => true };
      if (p === '/parent/file') return { isDirectory: () => false };
      throw fsError(p === '/parent/denied' ? 'EACCES' : 'ENOENT');
    });

    // When
    const result = await createDirectoryBrowser().listDirectories('/parent', { showHidden: false });

    // Then
    expect(result.entries).toEqual([
      { name: 'directory', path: '/parent/directory', isGitRepository: false },
    ]);
    expect(io.stat).not.toHaveBeenCalledWith('/parent/broken/.git');
    expect(io.stat).not.toHaveBeenCalledWith('/parent/denied/.git');
  });

  it('uses both .git files and directories as hints, including for the current directory', async () => {
    // Given: worktrees use a .git file, and denied lookups are only missing hints
    io.readdir.mockResolvedValue([entry('worktree'), entry('repository'), entry('denied')]);
    io.stat.mockImplementation(async (p: string) => {
      if (p === '/parent/worktree/.git') return { isDirectory: () => false };
      if (p === '/parent/repository/.git' || p === '/parent/.git')
        return { isDirectory: () => true };
      throw fsError('EPERM');
    });

    // When
    const result = await createDirectoryBrowser().listDirectories('/parent', { showHidden: false });

    // Then
    expect(result.isGitRepository).toBe(true);
    expect(result.entries.map(({ name, isGitRepository }) => [name, isGitRepository])).toEqual([
      ['denied', false],
      ['repository', true],
      ['worktree', true],
    ]);
    expect(io.stat).toHaveBeenCalledTimes(4);
  });

  it.each([1000, 1001])(
    'caps %i directories after sorting and before Git lookups',
    async (count) => {
      // Given: filtered entries do not consume the cap, and filesystem order is reversed
      const names = Array.from(
        { length: count },
        (_, index) => `folder-${String(index).padStart(4, '0')}`,
      );
      io.readdir.mockResolvedValue([
        entry('.hidden'),
        entry('file', 'file'),
        ...[...names].reverse().map((name) => entry(name)),
      ]);

      // When
      const result = await createDirectoryBrowser().listDirectories('/parent', {
        showHidden: false,
      });

      // Then
      expect(result.entries.map(({ name }) => name)).toEqual(names.slice(0, 1000));
      expect(result.truncated).toBe(count > 1000);
      expect(io.stat).toHaveBeenCalledTimes(1001);
      expect(io.stat).not.toHaveBeenCalledWith('/parent/folder-1000/.git');
    },
  );

  it('bounds concurrent link checks and Git lookups', async () => {
    // Given: stat stays pending for one microtask so overlapping calls are observable
    io.readdir.mockResolvedValue(Array.from({ length: 40 }, (_, i) => entry(`link-${i}`, 'link')));
    let active = 0;
    let peak = 0;
    io.stat.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return { isDirectory: () => true };
    });

    // When
    const result = await createDirectoryBrowser().listDirectories('/parent', { showHidden: false });

    // Then
    expect(result.entries).toHaveLength(40);
    expect(io.stat).toHaveBeenCalledTimes(81);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(16);
  });

  it.each([
    ['ENOENT', 404, 'Directory does not exist.'],
    ['ENOTDIR', 400, 'Path is not a directory.'],
    ['ENAMETOOLONG', 400, 'Directory path is too long.'],
    ['ELOOP', 400, 'Directory path contains too many symbolic links.'],
    ['EACCES', 403, 'Permission denied when reading directory.'],
    ['EPERM', 403, 'Permission denied when reading directory.'],
  ])('maps a directory read failure %s to %i', async (code, statusCode, message) => {
    // Given
    io.readdir.mockRejectedValue(fsError(code));

    // When
    const result = createDirectoryBrowser().listDirectories('/parent', { showHidden: false });

    // Then
    await expect(result).rejects.toMatchObject({ statusCode, message });
    expect(io.stat).not.toHaveBeenCalled();
  });

  it('propagates unexpected filesystem failures', async () => {
    // Given
    const error = fsError('EIO');
    io.readdir.mockRejectedValue(error);

    // When
    const result = createDirectoryBrowser().listDirectories('/parent', { showHidden: false });

    // Then
    await expect(result).rejects.toBe(error);
  });
});
