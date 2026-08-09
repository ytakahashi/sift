import type { Note } from './types';

/**
 * Whether a note still matches the current diff.
 *
 * Shared by every consumer that treats live and stale notes differently (line
 * anchoring, list grouping, agent-facing filtering), so they cannot disagree
 * about what "stale" means.
 */
export function isLiveNote(note: Note): boolean {
  return note.staleness.kind === 'live';
}
