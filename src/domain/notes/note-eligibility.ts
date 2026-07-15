import type { DiffFile } from '../diff/types';

/**
 * Whether notes can be attached to this file.
 *
 * Submodules are excluded: their worktree generation cannot be fingerprinted
 * in one batch subprocess (`git ls-files -s` records the index commit, not
 * the submodule's actual worktree state), so allowing notes on them would
 * leave reconcile unable to detect changes.
 *
 * This single predicate is shared by creation-time target resolution,
 * reconcile's presence check, generation path collection, and the UI's
 * "Add Note" visibility, so the four sites can never disagree.
 */
export function isNoteEligibleFile(file: Pick<DiffFile, 'kind'>): boolean {
  return file.kind !== 'submodule';
}
