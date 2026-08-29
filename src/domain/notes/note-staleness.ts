import type { Note } from './types';

/**
 * Whether a note still matches its current repository state and applicable
 * diff anchor.
 *
 * Shared by every consumer that treats live and stale notes differently (line
 * anchoring, list grouping, agent-facing filtering), so they cannot disagree
 * about what "stale" means.
 */
export function isLiveNote(note: Note): boolean {
  return note.staleness.kind === 'live';
}
