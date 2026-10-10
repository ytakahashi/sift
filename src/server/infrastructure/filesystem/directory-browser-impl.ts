import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { DirectoryEntry } from '../../../domain/filesystem/directory-listing';
import { DirectoryBrowseError, type DirectoryBrowser } from '../../services/directory-browser';

const ENTRY_LIMIT = 1000;
const STAT_CONCURRENCY = 16;

async function mapWithConcurrency<T, R>(items: T[], map: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(STAT_CONCURRENCY, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await map(items[index]);
      }
    }),
  );
  return results;
}

async function isDirectory(directoryPath: string): Promise<boolean> {
  try {
    return (await stat(directoryPath)).isDirectory();
  } catch (_error: unknown) {
    // Broken or inaccessible links must not prevent browsing their parent.
    return false;
  }
}

async function isGitRepository(directoryPath: string): Promise<boolean> {
  try {
    // Worktrees and submodules use a file here. This is only a display hint;
    // repository validation remains the responsibility of the add operation.
    await stat(path.join(directoryPath, '.git'));
    return true;
  } catch (_error: unknown) {
    return false;
  }
}

function compareNames(a: string, b: string): number {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA !== lowerB) return lowerA < lowerB ? -1 : 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

function throwBrowseError(error: unknown): never {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  switch (code) {
    case 'ENOENT':
      throw new DirectoryBrowseError('Directory does not exist.', 404);
    case 'ENOTDIR':
      throw new DirectoryBrowseError('Path is not a directory.', 400);
    case 'ENAMETOOLONG':
      throw new DirectoryBrowseError('Directory path is too long.', 400);
    case 'ELOOP':
      throw new DirectoryBrowseError('Directory path contains too many symbolic links.', 400);
    case 'EACCES':
    case 'EPERM':
      throw new DirectoryBrowseError('Permission denied when reading directory.', 403);
    default:
      throw error;
  }
}

export function createDirectoryBrowser(): DirectoryBrowser {
  return {
    async listDirectories(inputPath, { showHidden }) {
      // Only an omitted path starts at home; an empty path is invalid input.
      if (inputPath !== undefined && !path.isAbsolute(inputPath)) {
        throw new DirectoryBrowseError('Directory path must be an absolute path.', 400);
      }
      if (inputPath?.includes('\0')) {
        throw new DirectoryBrowseError('Directory path contains invalid characters.', 400);
      }
      const directoryPath = path.resolve(inputPath ?? homedir());
      const children = await readdir(directoryPath, { withFileTypes: true }).catch(
        throwBrowseError,
      );
      const visible = children.filter(
        (entry) => entry.name !== '.git' && (showHidden || !entry.name.startsWith('.')),
      );
      // Bound filesystem operations even when a directory contains many symbolic links.
      const directoryFlags = await mapWithConcurrency(visible, async (entry) =>
        entry.isDirectory()
          ? true
          : entry.isSymbolicLink() && (await isDirectory(path.join(directoryPath, entry.name))),
      );
      const directories = visible
        .filter((_entry, index) => directoryFlags[index])
        .sort((a, b) => compareNames(a.name, b.name));
      // Cap after filtering and sorting so the displayed subset is stable and
      // excluded children never incur a Git hint lookup.
      const entries = await mapWithConcurrency(
        directories.slice(0, ENTRY_LIMIT),
        async (entry): Promise<DirectoryEntry> => {
          const entryPath = path.join(directoryPath, entry.name);
          return {
            name: entry.name,
            path: entryPath,
            isGitRepository: await isGitRepository(entryPath),
          };
        },
      );
      const parentPath = path.dirname(directoryPath);
      return {
        path: directoryPath,
        isGitRepository: await isGitRepository(directoryPath),
        parentPath: parentPath === directoryPath ? null : parentPath,
        entries,
        truncated: directories.length > ENTRY_LIMIT,
      };
    },
  };
}
