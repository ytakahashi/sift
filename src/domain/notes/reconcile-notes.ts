import type { ConfirmedFileGeneration, FileGeneration } from '../diff/file-generation';
import { serializeFileGeneration } from '../diff/file-generation';
import type { DiffFile } from '../diff/types';
import type { AnchoredNote } from './anchored-note';
import { isNoteEligibleFile } from './note-eligibility';
import { resolveLineNoteTarget } from './resolve-line-note-target';
import type { NoteStaleness } from './types';

export interface NoteReconcileRecord {
  note: AnchoredNote;
  /**
   * Worktree generation of the target file when the note was created.
   * Always confirmed: creation rejects notes whose generation is unavailable.
   */
  generation: ConfirmedFileGeneration;
  /** For line notes: contents of the anchored range at creation (re-anchoring baseline). */
  lineContents?: string[];
}

export interface ReconcileNotesInput {
  records: NoteReconcileRecord[];
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
  /** Current worktree generations keyed by repository-relative path. */
  generations: ReadonlyMap<string, FileGeneration>;
}

export interface ReconcileNotesResult {
  /**
   * Every input record, with staleness recomputed and line notes re-anchored
   * where their content moved between panes. Notes are never dropped here.
   */
  records: NoteReconcileRecord[];
  /** True when any note changed staleness or was re-anchored (drives change notification). */
  changed: boolean;
}

const LIVE: NoteStaleness = { kind: 'live' };

/**
 * Recomputes, for every stored note, whether it still matches the current diff
 * and worktree state.
 *
 * Per note, three checks run in order; the first one that fails decides the
 * stale reason:
 * 1. Presence  — a note-eligible pane file with the note's fileId must still
 *    exist in some pane. Covers commit/discard/deletion and the path being
 *    replaced by a submodule. Failure means 'file-out-of-diff'.
 * 2. Generation — the file's current worktree generation must equal the
 *    creation-time one. `unavailable` (or a missing map entry) means
 *    indeterminate, never "changed", and equally never "recovered": every
 *    already-stale note holds its verdict, whatever its reason, instead of
 *    returning to live on a state nothing could read.
 *    Stage/unstage/commit do not touch the worktree, so they pass here.
 *    Failure means 'content-changed'.
 * 3. Re-anchor (line notes) — the target must re-resolve with path, line
 *    range and all line contents matching, preferring the stored bucket.
 *    Content moved to the other pane is followed by rewriting bucket/hunkId;
 *    an unresolvable target (e.g. line shifts from partial staging) means
 *    'range-unresolved' rather than being mis-anchored.
 *
 * Nothing is discarded, and a stale note keeps its creation-time anchor
 * untouched, so restoring the file to the state it had when the note was
 * written makes the note live again. That also makes this pass idempotent:
 * reconciling twice against the same state reports no change the second time,
 * which is what keeps change notifications from feeding back into themselves.
 */
export function reconcileNotes(input: ReconcileNotesInput): ReconcileNotesResult {
  const records: NoteReconcileRecord[] = [];
  let changed = false;

  for (const record of input.records) {
    const reconciled = reconcileRecord(record, input);
    if (reconciled !== record) {
      changed = true;
    }
    records.push(reconciled);
  }

  return { records, changed };
}

function reconcileRecord(
  record: NoteReconcileRecord,
  input: ReconcileNotesInput,
): NoteReconcileRecord {
  const paneFile = findEligiblePaneFile(record.note.target.fileId, input);
  if (!paneFile) {
    return withStaleness(record, { kind: 'stale', reason: 'file-out-of-diff' });
  }

  const current = input.generations.get(paneFile.path);
  if (isIndeterminate(current)) {
    // An indeterminate current state can confirm a recovery no more than it can
    // confirm a change, so an already-stale note holds its verdict whatever the
    // reason: returning to live would claim the note matches content that could
    // not be read. Only this check is suspended, not the pass: a live note goes
    // on to the range check, which is decided from the diff that was read
    // successfully and therefore stays in force.
    if (record.note.staleness.kind === 'stale') {
      return record;
    }
  } else if (hasGenerationChanged(record.generation, current)) {
    return withStaleness(record, { kind: 'stale', reason: 'content-changed' });
  }

  if (record.note.target.kind === 'file') {
    return withStaleness(record, LIVE);
  }

  // A line record without its content baseline cannot be re-anchored safely;
  // mark it rather than risk attaching to the wrong content.
  if (record.lineContents === undefined) {
    return withStaleness(record, { kind: 'stale', reason: 'range-unresolved' });
  }

  const resolution = resolveLineNoteTarget({
    workingFiles: input.workingFiles,
    stagedFiles: input.stagedFiles,
    path: paneFile.path,
    startLine: record.note.target.startNewLineNumber,
    endLine: record.note.target.endNewLineNumber,
    bucketConstraint: { kind: 'preferred', bucket: record.note.target.bucket },
    requiredLineContents: record.lineContents,
  });
  if (resolution.kind !== 'resolved') {
    return withStaleness(record, { kind: 'stale', reason: 'range-unresolved' });
  }

  if (
    resolution.target.bucket === record.note.target.bucket &&
    resolution.target.hunkId === record.note.target.hunkId
  ) {
    return withStaleness(record, LIVE);
  }

  return {
    ...record,
    note: {
      ...record.note,
      target: {
        ...record.note.target,
        bucket: resolution.target.bucket,
        hunkId: resolution.target.hunkId,
      },
      staleness: LIVE,
    },
  };
}

/**
 * Applies a recomputed staleness, returning the record itself when nothing
 * moved. reconcileNotes detects changes by identity, so a pass that decides
 * the same thing as last time must not allocate a new record.
 */
function withStaleness(record: NoteReconcileRecord, staleness: NoteStaleness): NoteReconcileRecord {
  return isSameStaleness(record.note.staleness, staleness)
    ? record
    : { ...record, note: { ...record.note, staleness } };
}

function isSameStaleness(a: NoteStaleness, b: NoteStaleness): boolean {
  if (a.kind === 'live' || b.kind === 'live') {
    return a.kind === b.kind;
  }
  return a.reason === b.reason;
}

function findEligiblePaneFile(fileId: string, input: ReconcileNotesInput): DiffFile | null {
  for (const file of [...input.workingFiles, ...input.stagedFiles]) {
    if (file.id === fileId && isNoteEligibleFile(file)) {
      return file;
    }
  }
  return null;
}

/** Indeterminate current state: a read error, a provider anomaly, or no entry. */
function isIndeterminate(
  current: FileGeneration | undefined,
): current is undefined | Extract<FileGeneration, { kind: 'unavailable' }> {
  return current === undefined || current.kind === 'unavailable';
}

function hasGenerationChanged(
  stored: ConfirmedFileGeneration,
  current: ConfirmedFileGeneration,
): boolean {
  return serializeFileGeneration(current) !== serializeFileGeneration(stored);
}
