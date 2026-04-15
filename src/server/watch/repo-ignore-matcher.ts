import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { MatchFunction } from 'chokidar';

function isWithinPath(candidatePath: string, basePath: string): boolean {
  return candidatePath === basePath || candidatePath.startsWith(`${basePath}${path.sep}`);
}

function isIgnoredByGit(repoRoot: string, relativePath: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--quiet', '--', relativePath], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    // Ignore matcher failures should not crash the watcher. If Git cannot
    // answer for a path, fall back to "not ignored" so change detection keeps
    // working, even if that means watching more paths than necessary.
    return false;
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
  const ignoredCache = new Map<string, boolean>();
  const allowedGitPaths = watchPaths.filter((watchPath) => watchPath !== repoRoot);
  const gitDirectory = resolveGitDirectory(repoRoot);

  return (watchPath: string): boolean => {
    if (watchPath === repoRoot) {
      return false;
    }

    const absolutePath = path.isAbsolute(watchPath) ? watchPath : path.resolve(repoRoot, watchPath);

    if (allowedGitPaths.some((allowedPath) => isWithinPath(absolutePath, allowedPath))) {
      return false;
    }

    if (isWithinPath(absolutePath, gitDirectory)) {
      return true;
    }

    if (!isWithinPath(absolutePath, repoRoot)) {
      return false;
    }

    const relativePath = path.relative(repoRoot, absolutePath);
    const cached = ignoredCache.get(relativePath);
    if (cached !== undefined) {
      return cached;
    }

    const ignored = isIgnoredByGit(repoRoot, relativePath);
    ignoredCache.set(relativePath, ignored);
    return ignored;
  };
}
