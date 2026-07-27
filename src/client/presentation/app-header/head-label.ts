import type { HeadRef } from '../../../domain/git/head-ref';

export interface HeadLabel {
  /** Text shown in the header. Long branch names are truncated by CSS. */
  text: string;
  /** Tooltip text, so a truncated ref is still readable in full. */
  title: string;
  /**
   * Styling hook for the detached state. The wording is already part of `text`;
   * this only lets the header mark the state visually.
   */
  detached: boolean;
}

/**
 * Builds the header label for a HEAD ref, or null when there is nothing
 * meaningful to show (no diff read yet, or Git could not report HEAD).
 */
export function toHeadLabel(head: HeadRef | null): HeadLabel | null {
  if (head === null || head.type === 'unknown') {
    return null;
  }

  if (head.type === 'branch') {
    return { text: head.name, title: `Branch: ${head.name}`, detached: false };
  }

  return {
    text: `${head.revision} (detached)`,
    title: `Detached HEAD at ${head.revision}`,
    detached: true,
  };
}
