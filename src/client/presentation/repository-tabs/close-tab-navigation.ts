import type { RepositoryId } from '../../../domain/repository/repository';

export type CloseTabNavigation =
  { type: 'none' } | { type: 'selection' } | { type: 'repository'; repoId: RepositoryId };

/**
 * Decides where the app should navigate after a tab is closed.
 *
 * - Closing a non-active tab keeps the current route.
 * - Closing the active tab moves to its neighbor; the caller is expected to pass
 *   the neighbor id returned from the tabs store (left first, then right).
 * - Closing the last remaining tab returns to the selection page.
 */
export function resolveCloseTabNavigation(
  closedId: RepositoryId,
  activeRepoId: RepositoryId | null,
  nextNeighborId: RepositoryId | null,
): CloseTabNavigation {
  if (closedId !== activeRepoId) {
    return { type: 'none' };
  }
  if (nextNeighborId === null) {
    return { type: 'selection' };
  }
  return { type: 'repository', repoId: nextNeighborId };
}
