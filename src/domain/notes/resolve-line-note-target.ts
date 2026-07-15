import type { DiffFile } from '../diff/types';
import { isNoteEligibleFile } from './note-eligibility';
import type { NoteBucket } from './types';

export interface ResolvedLineNoteTarget {
  fileId: string;
  hunkId: string;
  bucket: NoteBucket;
  /** Content of the matched diff line, recorded as the re-anchoring baseline. */
  lineContent: string;
}

export type LineNoteTargetResolution =
  | { kind: 'resolved'; target: ResolvedLineNoteTarget }
  | { kind: 'not-found' }
  /** The target exists in both panes; the caller must ask for an explicit bucket. */
  | { kind: 'ambiguous' };

export type BucketConstraint =
  /** Search one pane only (creation with an explicit bucket). */
  | { kind: 'only'; bucket: NoteBucket }
  /**
   * Try one pane first, then fall back to the other (reconcile re-anchoring
   * with the stored bucket). Never ambiguous.
   */
  | { kind: 'preferred'; bucket: NoteBucket };

export interface ResolveLineNoteTargetOptions {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
  /** Repository-relative path, as displayed by the diff. */
  path: string;
  /** New-file-side line number (worktree for working, index for staged). */
  line: number;
  /** Omit to search both panes; ambiguous when both match. */
  bucketConstraint?: BucketConstraint;
  /**
   * When set, a candidate line matches only if its content equals this value.
   * Re-anchoring passes the stored content so a note never re-attaches to
   * different content that happens to sit at the same line number.
   */
  requiredLineContent?: string;
}

/**
 * Resolves a (path, line) pair against the current diff.
 *
 * The resolution unit is the whole target, not the file: a pane matches only
 * if it contains the line itself. This lets "the file exists in working but
 * the line only in staged" fall through to staged instead of failing.
 * Only note-eligible files are considered (submodules never match).
 *
 * Shared by creation and reconcile re-anchoring so the resolution rules have
 * a single implementation.
 */
export function resolveLineNoteTarget(
  options: ResolveLineNoteTargetOptions,
): LineNoteTargetResolution {
  const { bucketConstraint } = options;

  if (bucketConstraint?.kind === 'only') {
    return resolveInPane(options, bucketConstraint.bucket) ?? { kind: 'not-found' };
  }

  if (bucketConstraint?.kind === 'preferred') {
    const preferred = resolveInPane(options, bucketConstraint.bucket);
    if (preferred) {
      return preferred;
    }
    return resolveInPane(options, otherBucket(bucketConstraint.bucket)) ?? { kind: 'not-found' };
  }

  const working = resolveInPane(options, 'working');
  const staged = resolveInPane(options, 'staged');
  if (working && staged) {
    return { kind: 'ambiguous' };
  }
  return working ?? staged ?? { kind: 'not-found' };
}

function otherBucket(bucket: NoteBucket): NoteBucket {
  return bucket === 'working' ? 'staged' : 'working';
}

function resolveInPane(
  options: ResolveLineNoteTargetOptions,
  bucket: NoteBucket,
): { kind: 'resolved'; target: ResolvedLineNoteTarget } | null {
  const files = bucket === 'working' ? options.workingFiles : options.stagedFiles;

  for (const file of files) {
    if (!isNoteEligibleFile(file) || file.path !== options.path) {
      continue;
    }

    for (const hunk of file.hunks) {
      // Check actual line presence rather than the hunk header range, matching
      // the anchor criterion the UI uses to render notes (row.newLineNumber).
      for (const line of hunk.lines) {
        if (line.newLineNumber !== options.line) {
          continue;
        }
        if (
          options.requiredLineContent !== undefined &&
          line.content !== options.requiredLineContent
        ) {
          continue;
        }
        return {
          kind: 'resolved',
          target: {
            fileId: file.id,
            hunkId: hunk.id,
            bucket,
            lineContent: line.content,
          },
        };
      }
    }
  }

  return null;
}
