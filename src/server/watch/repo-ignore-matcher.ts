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
  const resolvedPath = execFileSync('git', ['rev-parse', '--git-path', '.'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

  return path.isAbsolute(resolvedPath) ? resolvedPath : path.join(repoRoot, resolvedPath);
}

export function createRepoIgnoreMatcher(repoRoot: string, watchPaths: string[]): MatchFunction {
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
