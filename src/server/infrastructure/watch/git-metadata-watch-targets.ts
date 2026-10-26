/**
 * Git metadata paths that signal repository state changes, resolved to
 * absolute paths via `git rev-parse --git-path`.
 *
 * Git replaces these files via rename (e.g. `index.lock` -> `index`), so they
 * are observed through their parent directories rather than watched directly.
 */
export interface GitMetadataWatchTargets {
  /** Metadata files whose replacement signals a change: `index`, `HEAD`, and `packed-refs`. */
  files: string[];
  /**
   * Distinct parent directories of `files`, watched as roots. Outside the
   * repository root, only the directories themselves and `files` inside them
   * are watched; every other descendant is ignored.
   */
  directories: string[];
  /**
   * Distinct parent directories of `HEAD` and `packed-refs`. These are always
   * Git directories, so their descendants other than `files` and refs (locks,
   * objects, logs) are ignored even inside the repository root. The index's
   * parent is not included because `GIT_INDEX_FILE` may place it in the worktree.
   */
  gitDirectories: string[];
  /** The refs directory, watched together with all of its descendants. */
  refsDirectory: string;
}
