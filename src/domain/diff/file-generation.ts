/**
 * Fingerprint of a file's worktree state, following Git blob semantics.
 *
 * Notes use this (not a diff-derived hash) to decide whether a file has
 * changed since a note was created. Diff-derived hashes have two blind
 * spots: the merged working+staged line set changes under stage/unstage
 * when the index holds intermediate content, and sorted line sets cannot
 * detect pure line reorders. A worktree blob fingerprint maps 1:1 to the
 * actual content, is unaffected by index operations (stage/unstage) and
 * by HEAD moves (commit), and detects reorders.
 *
 * Submodules are intentionally not representable: their worktree state
 * cannot be fingerprinted without per-submodule subprocesses, so they are
 * excluded from notes entirely (see isNoteEligibleFile).
 */
export type FileGeneration =
  | { kind: 'file'; blobId: string; mode: string }
  | { kind: 'symlink'; targetHash: string }
  | { kind: 'deleted' }
  /**
   * The generation could not be determined (e.g. a read error, or the
   * worktree entry is neither a regular file nor a symlink). This means
   * "indeterminate", never "changed": reconcile must not discard notes
   * based on it. `reason` is diagnostic only and takes no part in identity.
   */
  | { kind: 'unavailable'; reason: string };

/** A generation that is safe to store as a note's creation-time anchor. */
export type ConfirmedFileGeneration = Exclude<FileGeneration, { kind: 'unavailable' }>;

/**
 * Stable string form of a confirmed generation, used for equality checks.
 * Only confirmed generations participate in identity; `unavailable` is
 * excluded at the type level so an indeterminate state can never be
 * compared as if it were a real generation.
 */
export function serializeFileGeneration(generation: ConfirmedFileGeneration): string {
  switch (generation.kind) {
    case 'file':
      return `file:${generation.blobId}:${generation.mode}`;
    case 'symlink':
      return `symlink:${generation.targetHash}`;
    case 'deleted':
      return 'deleted';
  }
}
