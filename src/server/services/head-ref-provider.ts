import type { HeadRef } from '../../domain/git/head-ref';

/**
 * Resolves the repository's current HEAD.
 *
 * Kept separate from DiffProvider: resolving HEAD is a different responsibility
 * than producing diffs, and extending DiffProvider would ripple through its
 * many existing mocks.
 */
export interface HeadRefProvider {
  getHeadRef(): Promise<HeadRef>;
}
