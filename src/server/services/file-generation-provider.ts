import type { FileGeneration } from '../../domain/diff/file-generation';

/**
 * Provides worktree generation fingerprints for note reconciliation.
 *
 * Kept separate from DiffProvider: fingerprinting worktree state is a
 * different responsibility than producing diffs, and extending DiffProvider
 * would ripple through its many existing mocks.
 */
export interface FileGenerationProvider {
  /**
   * Fetches generations for the given repository-relative paths in one batch.
   * Implementations must not spawn a subprocess per path; a whole request is
   * served by a bounded number of processes regardless of path count.
   * Indeterminate entries come back as `unavailable`, never as `deleted`.
   */
  getWorktreeGenerations(paths: string[]): Promise<Map<string, FileGeneration>>;
}
