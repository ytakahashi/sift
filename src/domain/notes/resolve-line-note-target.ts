import type { DiffFile, DiffHunk } from '../diff/types';
import { isNoteEligibleFile } from './note-eligibility';
import type { NoteBucket } from './types';

export interface ResolvedLineNoteTarget {
  fileId: string;
  hunkId: string;
  bucket: NoteBucket;
  /** Content of the matched diff lines, recorded as the re-anchoring baseline. */
  lineContents: string[];
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
  /** Inclusive new-file-side range (worktree for working, index for staged). */
  startLine: number;
  endLine: number;
  /** Omit to search both panes; ambiguous when both match. */
  bucketConstraint?: BucketConstraint;
  /**
   * When set, a candidate range matches only if every line equals the
   * corresponding value. Re-anchoring passes the stored contents so a note
   * never re-attaches to a partially changed range.
   */
  requiredLineContents?: string[];
}

/**
 * Maps each new-file-side line in a hunk to its content. The single source
 * of truth for "which lines does this hunk actually have", shared by range
 * containment checks and content extraction so the two can never drift apart.
 */
function buildLineContentMap(hunk: DiffHunk): Map<number, string> {
  const contentByLine = new Map<number, string>();
  for (const line of hunk.lines) {
    if (line.newLineNumber !== undefined) {
      contentByLine.set(line.newLineNumber, line.content);
    }
  }
  return contentByLine;
}

/**
 * Extracts the contents of an inclusive line range from a hunk's line map,
 * in order, or undefined if the range is invalid or any line in it is absent
 * from the hunk. Actual diff lines are checked instead of trusting hunk
 * header arithmetic.
 */
function extractRangeContents(
  contentByLine: Map<number, string>,
  startLine: number,
  endLine: number,
): string[] | undefined {
  if (
    !Number.isSafeInteger(startLine) ||
    !Number.isSafeInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine
  ) {
    return undefined;
  }

  // Bound the walk by the hunk's own line count so an unreasonable request
  // range (e.g. startLine=5, endLine=1_000_000) cannot loop unbounded.
  const rangeLength = endLine - startLine + 1;
  if (rangeLength > contentByLine.size) {
    return undefined;
  }

  const contents: string[] = [];
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const content = contentByLine.get(lineNumber);
    if (content === undefined) {
      return undefined;
    }
    contents.push(content);
  }
  return contents;
}

/**
 * Finds the hunk containing every new-file-side line in an inclusive range.
 */
export function findHunkContainingRange(
  hunks: DiffHunk[],
  startLine: number,
  endLine: number,
): DiffHunk | undefined {
  for (const hunk of hunks) {
    if (extractRangeContents(buildLineContentMap(hunk), startLine, endLine) !== undefined) {
      return hunk;
    }
  }

  return undefined;
}

/**
 * Resolves a (path, line range) pair against the current diff.
 *
 * The resolution unit is the whole target, not the file: a pane matches only
 * if one hunk contains the complete range. This lets "the file exists in
 * working but the range only in staged" fall through to staged instead of failing.
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
      const lineContents = extractRangeContents(
        buildLineContentMap(hunk),
        options.startLine,
        options.endLine,
      );
      if (lineContents === undefined) {
        continue;
      }

      if (
        options.requiredLineContents !== undefined &&
        !hasEqualLineContents(lineContents, options.requiredLineContents)
      ) {
        continue;
      }

      return {
        kind: 'resolved',
        target: {
          fileId: file.id,
          hunkId: hunk.id,
          bucket,
          lineContents,
        },
      };
    }
  }

  return null;
}

function hasEqualLineContents(actual: string[], required: string[]): boolean {
  return (
    actual.length === required.length &&
    actual.every((content, index) => content === required[index])
  );
}
