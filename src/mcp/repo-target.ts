export interface RepoRootResolver {
  resolve(): string;
}

/**
 * Wraps `resolveRepoRoot` so the git root lookup happens lazily on the first
 * `resolve()` call and is cached for the process lifetime after that. This
 * lets MCP initialization and `tools/list` succeed even when `candidatePath`
 * is not (yet) a git repository; only the first tool call pays for, and can
 * fail on, root resolution. A failed resolution is not cached, so the next
 * tool call retries against the current filesystem state (e.g. after the
 * user runs `git init`, or once a path that was temporarily unavailable is
 * restored).
 */
export function createRepoRootResolver(
  candidatePath: string,
  resolveRepoRoot: (targetPath: string) => string,
): RepoRootResolver {
  let cachedRoot: string | undefined;

  return {
    resolve(): string {
      if (cachedRoot === undefined) {
        cachedRoot = resolveRepoRoot(candidatePath);
      }
      return cachedRoot;
    },
  };
}
