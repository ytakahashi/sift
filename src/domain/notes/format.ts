import type { Note, NoteStaleReason } from './types';

const STALE_REASON_DESCRIPTION: Record<NoteStaleReason, string> = {
  'file-out-of-diff': 'this file is no longer part of the diff',
  'content-changed': 'the file changed after this note was written',
  'range-unresolved': 'the lines this note points at are no longer in the diff',
};

/**
 * Human-readable explanation of why a note is stale. Shared by the UI and the
 * clipboard format so one reason is never described two different ways.
 */
export function describeNoteStaleReason(reason: NoteStaleReason): string {
  return STALE_REASON_DESCRIPTION[reason];
}

export function formatNoteLocation(note: Note): string {
  if (note.kind === 'file') {
    return note.path;
  }
  const endSuffix = note.startLine === note.endLine ? '' : `-L${note.endLine}`;
  return `${note.path}#L${note.startLine}${endSuffix}`;
}

/**
 * Copied text is typically pasted into an agent prompt, where a stale note
 * would read as a finding about the current diff. Stale notes therefore carry
 * their reason instead of being copied as if they still applied.
 */
function formatStaleSuffix(note: Note): string {
  return note.staleness.kind === 'live'
    ? ''
    : ` (stale: ${describeNoteStaleReason(note.staleness.reason)})`;
}

export function formatNoteForClipboard(note: Note): string {
  return `> ${formatNoteLocation(note)}${formatStaleSuffix(note)}\n${note.body}`;
}

export function formatNotesForClipboard(notes: Note[]): string {
  return notes.map((note) => formatNoteForClipboard(note)).join('\n\n');
}
