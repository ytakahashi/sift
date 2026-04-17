import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { MatchFunction } from 'chokidar';

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
        absolutePath: resolvePath(repoRoot, ignoredPath.replace(/[\\/]$/, '')),
        directory: /[\\/]$/.test(ignoredPath),
      }));
  } catch {
    // Ignore matcher setup should not crash the watcher. If Git cannot provide
    // ignored paths, fall back to watching more paths rather than missing
    // repository changes.
    return [];
  }
}

function resolveGitDirectory(repoRoot: string): string {
  try {
    const resolvedPath = execFileSync('git', ['rev-parse', '--git-path', '.'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();

    return path.isAbsolute(resolvedPath) ? resolvedPath : path.join(repoRoot, resolvedPath);
  } catch {
    // Keep matcher setup best-effort like ignored path loading. The common
    // layout fallback still prevents watching most internal Git churn.
    return path.join(repoRoot, '.git');
  }
}

export function createRepoIgnoreMatcher(repoRoot: string, watchPaths: string[]): MatchFunction {
  // Chokidar calls this for every candidate path under the watched roots.
  // The matcher ignores paths that cannot affect the displayed diff, while
  // keeping explicit metadata watch paths active:
  //
  // - `/repo/.git/objects/12/abcd...` => ignored; object database churn should
  //   not schedule refreshes directly.
  // - `/repo/.git/index` => not ignored when it is listed in watchPaths; this is
  //   the primary signal for stage/unstage.
  // - `/repo/node_modules/pkg/index.js` => ignored when Git reports
  //   `node_modules/` as an ignored directory.
  // - `/repo/src/file.ts` => not ignored unless Git reports that exact path or
  //   one of its parent directories as ignored.
  // - `/external/file.ts` => not ignored here; chokidar should only pass these
  //   when the path was explicitly watched.
  const allowedGitPaths = watchPaths.filter((watchPath) => watchPath !== repoRoot);
  const gitDirectory = resolveGitDirectory(repoRoot);
  const ignoredPaths = listIgnoredPaths(repoRoot);

  return (watchPath: string): boolean => {
    if (watchPath === repoRoot) {
      return false;
    }

    const absolutePath = resolvePath(repoRoot, watchPath);

    if (allowedGitPaths.some((allowedPath) => isWithinPath(absolutePath, allowedPath))) {
      return false;
    }

    if (isWithinPath(absolutePath, gitDirectory)) {
      return true;
    }

    if (!isWithinPath(absolutePath, repoRoot)) {
      return false;
    }

    return ignoredPaths.some((ignoredPath) => {
      if (ignoredPath.directory) {
        return isWithinPath(absolutePath, ignoredPath.absolutePath);
      }

      return absolutePath === ignoredPath.absolutePath;
    });
  };
}
