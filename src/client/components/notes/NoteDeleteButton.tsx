import { useId, type ReactElement } from 'react';
import { isProtectedReviewThread, type ReviewSession } from '../../../domain/notes/review-session';
import type { Note } from '../../../domain/notes/types';
import { NoteActionButton } from './NoteActionButton';

interface NoteDeleteButtonProps {
  note: Note;
  review?: ReviewSession | null;
  onClick: () => void;
  disabled?: boolean;
}

const REVIEW_PROTECTION_REASON = 'Protected by the current review.';

export function NoteDeleteButton({
  note,
  review,
  onClick,
  disabled,
}: NoteDeleteButtonProps): ReactElement {
  const descriptionId = useId();
  const protectedByReview = isProtectedReviewThread(note, review ?? undefined);

  const button = (
    <NoteActionButton
      label="Delete"
      onClick={onClick}
      variant="danger"
      disabled={disabled || protectedByReview}
      aria-describedby={protectedByReview ? descriptionId : undefined}
      title={protectedByReview ? REVIEW_PROTECTION_REASON : undefined}
    />
  );

  return protectedByReview ? (
    <span className="note-delete-protected">
      {button}
      <span id={descriptionId}>{REVIEW_PROTECTION_REASON}</span>
    </span>
  ) : (
    button
  );
}
