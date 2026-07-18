import type { ConfirmedFileGeneration, FileGeneration } from '../diff/file-generation';
import { serializeFileGeneration } from '../diff/file-generation';
import type { DiffFile } from '../diff/types';
import { isNoteEligibleFile } from './note-eligibility';
import { resolveLineNoteTarget } from './resolve-line-note-target';
import type { Note } from './types';

export interface NoteReconcileRecord {
  note: Note;
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
  /** Surviving records, re-anchored where the content moved between panes. */
  records: NoteReconcileRecord[];
  /** True when any note was discarded or re-anchored (drives change notification). */
  changed: boolean;
}

/**
 * Validates stored notes against the current diff and worktree state.
 *
 * Per note, three AND-ed checks run in order:
 * 1. Presence  — a note-eligible pane file with the note's fileId must still
 *    exist in some pane. Covers commit/discard/deletion and the path being
 *    replaced by a submodule.
 * 2. Generation — the file's current worktree generation must equal the
 *    creation-time one. `unavailable` (or a missing map entry) means
 *    indeterminate, never "changed": the note is kept as-is.
 *    Stage/unstage/commit do not touch the worktree, so they pass here.
 * 3. Re-anchor (line notes) — the target must re-resolve with path, line
 *    range and all line contents matching, preferring the stored bucket.
 *    Content moved to the other pane is followed by rewriting bucket/hunkId;
 *    an unresolvable target (e.g. line shifts from partial staging) is
 *    discarded rather than mis-anchored.
 *
 * This function is the single extension point for the future stale-marking
 * lifecycle: "discard" would become "mark" here.
 */
export function reconcileNotes(input: ReconcileNotesInput): ReconcileNotesResult {
  const surviving: NoteReconcileRecord[] = [];
  let changed = false;

  for (const record of input.records) {
    const reconciled = reconcileRecord(record, input);
    if (!reconciled) {
      changed = true;
      continue;
    }
    if (reconciled !== record) {
      changed = true;
    }
    surviving.push(reconciled);
  }

  return { records: surviving, changed };
}

function reconcileRecord(
  record: NoteReconcileRecord,
  input: ReconcileNotesInput,
): NoteReconcileRecord | null {
  const paneFile = findEligiblePaneFile(record.note.target.fileId, input);
  if (!paneFile) {
    return null;
  }

  if (hasGenerationChanged(record.generation, input.generations.get(paneFile.path))) {
    return null;
  }

  if (record.note.target.kind === 'file') {
    return record;
  }

  // A line record without its content baseline cannot be re-anchored safely;
  // treat it as invalid rather than risk attaching to the wrong content.
  if (record.lineContents === undefined) {
    return null;
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
    return null;
  }

  if (
    resolution.target.bucket === record.note.target.bucket &&
    resolution.target.hunkId === record.note.target.hunkId
  ) {
    return record;
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
    },
  };
}

function findEligiblePaneFile(fileId: string, input: ReconcileNotesInput): DiffFile | null {
  for (const file of [...input.workingFiles, ...input.stagedFiles]) {
    if (file.id === fileId && isNoteEligibleFile(file)) {
      return file;
    }
  }
  return null;
}

function hasGenerationChanged(
  stored: ConfirmedFileGeneration,
  current: FileGeneration | undefined,
): boolean {
  // Indeterminate current state (read error, provider anomaly) must never be
  // read as a change; the check is simply skipped for this pass.
  if (current === undefined || current.kind === 'unavailable') {
    return false;
  }
  return serializeFileGeneration(current) !== serializeFileGeneration(stored);
}
