import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { MatchFunction } from 'chokidar';
import type { GitMetadataWatchTargets } from './git-metadata-watch-targets';

function isWithinPath(candidatePath: string, basePath: string): boolean {
  return candidatePath === basePath || candidatePath.startsWith(`${basePath}${path.sep}`);
}

interface IgnoredPath {
  absolutePath: string;
  directory: boolean;
}

function resolvePath(repoRoot: string, targetPath: string): string {
  return path.isAbsolute(targetPath) ? targetPath : path.join(repoRoot, targetPath);
}

function listIgnoredPaths(repoRoot: string): IgnoredPath[] {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    );

    return output
      .split('\0')
      .filter(Boolean)
      .map((ignoredPath) => ({
        absolutePath: resolvePath(repoRoot, ignoredPath.replace(/[/]$/, '')),
        directory: /[/]$/.test(ignoredPath),
      }));
  } catch {
    // Ignore matcher setup should not crash the watcher. If Git cannot provide
    // ignored paths, fall back to watching more paths rather than missing
    // repository changes.
    return [];
  }
}

export function createRepoIgnoreMatcher(
  repoRoot: string,
  targets: GitMetadataWatchTargets,
): MatchFunction {
  // Chokidar calls this for every candidate path under the watched roots.
  // The matcher ignores paths that cannot affect the displayed diff, while
  // keeping Git metadata that signals repository state changes active:
  //
  // - `/repo/.git` => not ignored; this metadata directory is watched so that
  //   replacing `index` via rename stays visible.
  // - `/repo/.git/index` => not ignored; this is the primary signal for
  //   stage/unstage.
  // - `/repo/.git/refs/heads/main` => not ignored; refs are watched recursively.
  // - `/repo/.git/index.lock`, `/repo/.git/objects/12/abcd...` => ignored;
  //   temporary locks and object database churn should not schedule refreshes.
  // - `/common/.git/objects/...` for a linked worktree at `/linked` => ignored,
  //   although it is outside repoRoot, because `/common/.git` is watched for
  //   shared `packed-refs`.
  // - `/tmp/custom/other` with `GIT_INDEX_FILE=/tmp/custom/index` => ignored;
  //   `/tmp/custom` is watched only for the index replacement.
  // - `/repo/src/file.ts` with `GIT_INDEX_FILE=/repo/custom-index` => judged
  //   by the gitignore rules below; the index's parent is the worktree itself.
  // - `/repo/node_modules/pkg/index.js` => ignored when Git reports
  //   `node_modules/` as an ignored directory.
  // - `/repo/src/file.ts` => not ignored unless Git reports that exact path or
  //   one of its parent directories as ignored.
  // - `/external/file.ts` => not ignored here; chokidar should only pass these
  //   when the path was explicitly watched.
  //
  // `targets.gitDirectories` always contains the current Git directory because
  // HEAD lives directly under it, so no separate Git directory lookup is needed.
  const ignoredPaths = listIgnoredPaths(repoRoot);

  return (watchPath: string): boolean => {
    if (watchPath === repoRoot) {
      return false;
    }

    const absolutePath = resolvePath(repoRoot, watchPath);

    // Parent directories must be allowed only by exact match; allowing their
    // descendants would also watch object database churn and temporary locks.
    if (
      targets.directories.includes(absolutePath) ||
      targets.files.includes(absolutePath) ||
      isWithinPath(absolutePath, targets.refsDirectory)
    ) {
      return false;
    }

    // Git directories may live inside repoRoot (`.git`) or outside it (shared
    // metadata of linked worktrees); their internals are ignored either way.
    if (targets.gitDirectories.some((directory) => isWithinPath(absolutePath, directory))) {
      return true;
    }

    if (!isWithinPath(absolutePath, repoRoot)) {
      // A metadata directory outside repoRoot (e.g. one holding a custom
      // GIT_INDEX_FILE) is watched only for its metadata files. Inside repoRoot
      // the same rule must not apply: a custom index may sit in the worktree,
      // and ignoring its parent's descendants would hide every worktree edit.
      return targets.directories.some((directory) => isWithinPath(absolutePath, directory));
    }

    return ignoredPaths.some((ignoredPath) => {
      if (ignoredPath.directory) {
        return isWithinPath(absolutePath, ignoredPath.absolutePath);
      }

      return absolutePath === ignoredPath.absolutePath;
    });
  };
}
