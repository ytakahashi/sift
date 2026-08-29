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
 * Submodules and other non-file worktree entries are intentionally not
 * representable as anchors. They are reported as `ineligible` so reconcile
 * can distinguish a confirmed invalid target from a transient read failure.
 */
export type FileGeneration =
  | { kind: 'file'; blobId: string; mode: string }
  | { kind: 'symlink'; targetHash: string }
  | { kind: 'deleted' }
  /**
   * A confirmed worktree entry that cannot carry a note, such as a directory,
   * gitlink, or other non-file entry. This is deterministic, so reconcile may
   * treat it as changed rather than suspending its decision.
   */
  | { kind: 'ineligible'; reason: string }
  /**
   * The generation could not be determined because of a transient or
   * unexpected error. This means "indeterminate", never "changed": reconcile
   * must not discard notes based on it. `reason` is diagnostic only and takes
   * no part in identity.
   */
  | { kind: 'unavailable'; reason: string };

/** A generation that is safe to store as a note's creation-time anchor. */
export type ConfirmedFileGeneration = Exclude<
  FileGeneration,
  { kind: 'ineligible' } | { kind: 'unavailable' }
>;

/**
 * Stable string form of a confirmed generation, used for equality checks.
 * Only confirmed generations participate in identity; non-anchor states are
 * excluded at the type level so they can never be compared as if they were a
 * real generation.
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
