import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import type { FileGeneration } from '../../../domain/diff/file-generation';
import type { FileGenerationProvider } from '../../services/file-generation-provider';
import { resolveSafePath } from '../safe-path';
import { GitClient } from './git-client';

/** Subset of fs.Stats the provider needs; keeps the fs seam mockable in tests. */
interface WorktreeEntryStats {
  isFile(): boolean;
  isSymbolicLink(): boolean;
  mode: number;
}

interface WorktreeFileSystem {
  lstat(path: string): Promise<WorktreeEntryStats>;
  readlink(path: string): Promise<string>;
}

interface WorktreeFileGenerationProviderOptions {
  git?: Pick<GitClient, 'hashObjects'>;
  fileSystem?: WorktreeFileSystem;
}

function isMissingEntryError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  );
}

function unavailable(error: unknown): FileGeneration {
  return {
    kind: 'unavailable',
    reason: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Fingerprints worktree files with Git blob semantics.
 *
 * All regular files of a request are hashed by a single
 * `git hash-object --stdin-paths` subprocess; symlinks, deletions and
 * submodule/gitlink entries are classified from one lstat per path without
 * additional subprocesses. Indeterminate states (read errors, non-file
 * entries, a failed hash batch) become `unavailable`, never `deleted`,
 * because a transient error must not be mistaken for a content change and
 * destroy notes.
 */
export class WorktreeFileGenerationProvider implements FileGenerationProvider {
  private readonly git: Pick<GitClient, 'hashObjects'>;
  private readonly fileSystem: WorktreeFileSystem;

  constructor(
    private readonly repoRoot: string,
    options: WorktreeFileGenerationProviderOptions = {},
  ) {
    this.git = options.git ?? new GitClient(repoRoot);
    this.fileSystem = options.fileSystem ?? fs;
  }

  async getWorktreeGenerations(paths: string[]): Promise<Map<string, FileGeneration>> {
    const generations = new Map<string, FileGeneration>();
    const regularFiles: Array<{ path: string; mode: string }> = [];

    for (const path of paths) {
      const classified = await this.classifyEntry(path);
      if (classified.kind === 'regular-file') {
        regularFiles.push({ path, mode: classified.mode });
      } else {
        generations.set(path, classified.generation);
      }
    }

    if (regularFiles.length > 0) {
      try {
        const blobIds = await this.git.hashObjects(regularFiles.map((file) => file.path));
        regularFiles.forEach((file, index) => {
          generations.set(file.path, { kind: 'file', blobId: blobIds[index], mode: file.mode });
        });
      } catch (error: unknown) {
        // A failed batch cannot be attributed to specific paths, so every
        // regular file of this batch is indeterminate. Partial output is
        // never adopted; the next notes API access retries the whole batch.
        for (const file of regularFiles) {
          generations.set(file.path, unavailable(error));
        }
      }
    }

    return generations;
  }

  private async classifyEntry(
    path: string,
  ): Promise<
    { kind: 'regular-file'; mode: string } | { kind: 'resolved'; generation: FileGeneration }
  > {
    let absolutePath: string;
    try {
      absolutePath = resolveSafePath(this.repoRoot, path);
    } catch (error: unknown) {
      return { kind: 'resolved', generation: unavailable(error) };
    }

    let stats: WorktreeEntryStats;
    try {
      stats = await this.fileSystem.lstat(absolutePath);
    } catch (error: unknown) {
      if (isMissingEntryError(error)) {
        return { kind: 'resolved', generation: { kind: 'deleted' } };
      }
      return { kind: 'resolved', generation: unavailable(error) };
    }

    if (stats.isSymbolicLink()) {
      try {
        const target = await this.fileSystem.readlink(absolutePath);
        // Fingerprint of the link target string itself (not the pointed-to
        // file): retargeting the link is the change notes should react to.
        const targetHash = createHash('sha1').update(target).digest('hex');
        return { kind: 'resolved', generation: { kind: 'symlink', targetHash } };
      } catch (error: unknown) {
        return { kind: 'resolved', generation: unavailable(error) };
      }
    }

    if (stats.isFile()) {
      // Normalize to Git's two regular-file modes (any exec bit => 100755).
      const mode = (stats.mode & 0o111) !== 0 ? '100755' : '100644';
      return { kind: 'regular-file', mode };
    }

    // Directories, gitlinks (submodule races), FIFOs, sockets, ...: not a
    // note-eligible worktree object. The pane diff will surface the real
    // state (e.g. a submodule entry) and the presence check handles discard.
    return {
      kind: 'resolved',
      generation: { kind: 'unavailable', reason: 'not a regular file or symlink' },
    };
  }
}
