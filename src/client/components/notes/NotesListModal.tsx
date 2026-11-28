import { useId, useRef, useState, type ReactElement } from 'react';
import {
  isProtectedReviewThread,
  type ReviewSession,
  type ReviewState,
  type ReviewVerdict,
} from '../../../domain/notes/review-session';
import type { Note } from '../../../domain/notes/types';
import {
  describeNoteStaleReason,
  formatNoteLocation,
  formatNotesForClipboard,
} from '../../../domain/notes/format';
import { isLiveNote } from '../../../domain/notes/note-staleness';
import { ModalDialog } from '../modal/ModalDialog';
import { CopyFeedbackTooltip } from './CopyFeedbackTooltip';
import { DeleteStaleNotesConfirmModal } from './DeleteStaleNotesConfirmModal';
import { FileNoteCreateForm } from './FileNoteCreateForm';
import { NoteActionButton } from './NoteActionButton';
import { NoteDeleteButton } from './NoteDeleteButton';
import { NoteThread } from './NoteThread';
import { useCopyFeedback } from './useCopyFeedback';

interface NotesListModalProps {
  notes: Note[];
  review: ReviewSession | null;
  onClose: () => void;
  onDeleteNote: (id: string) => void | Promise<void>;
  /** Deletes stale notes eligible for removal in one request. */
  onDeleteStaleNotes: () => void;
  /** Jumps to the note's file/pane in the main diff pane. */
  onSelectLocation: (note: Note) => void;
  /** Whether the note currently has a destination in the main diff pane. */
  canSelectLocation: (note: Note) => boolean;
  onAddNote: (path: string, body: string) => Promise<void>;
  /** Disables both deletions while another notes mutation is in flight. */
  mutationDisabled?: boolean;
}

const REVIEW_STATUS_LABELS: Record<ReviewState, string> = {
  'awaiting-response': 'Awaiting response',
  'awaiting-review': 'Awaiting review',
  approved: 'Complete',
  'needs-user': 'Needs user input',
  'peer-gone': 'Peer disconnected',
};

const REVIEW_VERDICT_LABELS: Record<ReviewVerdict, string> = {
  request_changes: 'Changes requested',
  comment: 'Comment',
  approve: 'Approved',
};

export function NotesListModal({
  notes,
  review,
  onClose,
  onDeleteNote,
  onDeleteStaleNotes,
  onSelectLocation,
  canSelectLocation,
  onAddNote,
  mutationDisabled = false,
}: NotesListModalProps): ReactElement {
  const { copied, copy } = useCopyFeedback();
  const [confirmingDeleteStale, setConfirmingDeleteStale] = useState(false);
  // Focus the close button rather than the note form so opening the list does
  // not drop the reader straight into typing.
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const liveNotes = notes.filter(isLiveNote);
  const staleNotes = notes.filter((note) => !isLiveNote(note));
  const deletableStaleCount = staleNotes.filter(
    (note) => !isProtectedReviewThread(note, review ?? undefined),
  ).length;
  const protectedStaleCount = staleNotes.length - deletableStaleCount;
  // Notes or review state can change while the confirmation is open.
  if (confirmingDeleteStale && deletableStaleCount === 0) {
    setConfirmingDeleteStale(false);
  }
  // Lead with the count that represents outstanding work. The stale count is
  // spelled out rather than folded into the total, so the header cannot be
  // read as "you still have this many things to look at".
  const countLabel =
    staleNotes.length > 0
      ? `${liveNotes.length} + ${staleNotes.length} stale`
      : String(liveNotes.length);

  const renderNote = (note: Note): ReactElement => {
    const stale = note.staleness.kind === 'stale';
    const locationStyle = {
      background: 'transparent',
      border: 'none',
      color: stale ? '#8b949e' : '#c9d1d9',
      fontSize: '0.8rem',
      padding: 0,
      textAlign: 'left' as const,
    };
    return (
      <div key={note.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {canSelectLocation(note) ? (
          <button
            onClick={() => onSelectLocation(note)}
            type="button"
            style={{ ...locationStyle, cursor: 'pointer' }}
          >
            {formatNoteLocation(note)}
          </button>
        ) : (
          <div style={locationStyle}>{formatNoteLocation(note)}</div>
        )}
        <div
          style={{
            backgroundColor: '#0d1117',
            border: `1px solid ${stale || note.status === 'resolved' ? '#484f58' : '#3fb950'}`,
            borderRadius: '4px',
            padding: '0.5rem',
          }}
        >
          <NoteThread note={note}>
            {note.staleness.kind === 'stale' && (
              <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: '0.35rem' }}>
                {describeNoteStaleReason(note.staleness.reason)}
              </div>
            )}
            <div style={{ whiteSpace: 'pre-wrap', color: '#c9d1d9', fontSize: '0.85rem' }}>
              {note.body}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <NoteDeleteButton
                note={note}
                review={review}
                onClick={() => void onDeleteNote(note.id)}
                disabled={mutationDisabled}
              />
            </div>
          </NoteThread>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Anchored below the header inside .app-main rather than centered. */}
      <ModalDialog
        titleId={titleId}
        initialFocusRef={closeButtonRef}
        onClose={onClose}
        panelStyle={{
          position: 'absolute',
          top: '40px',
          right: '1rem',
          left: 'auto',
          transform: 'none',
          width: '500px',
          maxHeight: 'calc(100% - 60px)',
        }}
      >
        <div
          style={{
            padding: '0.8rem 1rem',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span id={titleId} style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            Your Notes ({countLabel})
          </span>
          <button
            ref={closeButtonRef}
            aria-label="Close"
            onClick={onClose}
            type="button"
            style={{
              background: 'transparent',
              color: '#8b949e',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>
        {review && (
          <div className="notes-review-status" role="status">
            Review · Round {review.round} · Last verdict: {REVIEW_VERDICT_LABELS[review.verdict]} ·{' '}
            {REVIEW_STATUS_LABELS[review.state]}
          </div>
        )}
        <div
          className="scroll-area"
          data-testid="notes-modal-scroll-area"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <FileNoteCreateForm disabled={mutationDisabled} onSave={onAddNote} />
          {notes.length === 0 && (
            <div style={{ color: '#8b949e', fontSize: '0.85rem', textAlign: 'center' }}>
              No notes yet.
            </div>
          )}
          {liveNotes.map(renderNote)}
          {staleNotes.length > 0 && (
            <>
              <div
                style={{
                  color: '#8b949e',
                  fontSize: '0.75rem',
                  borderTop: '1px solid #30363d',
                  paddingTop: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  Stale (
                  {protectedStaleCount > 0
                    ? `${deletableStaleCount} deletable · ${protectedStaleCount} protected`
                    : deletableStaleCount}
                  )
                </span>
                {deletableStaleCount > 0 && (
                  <NoteActionButton
                    label="Delete stale notes"
                    onClick={() => setConfirmingDeleteStale(true)}
                    variant="danger"
                    disabled={mutationDisabled}
                  />
                )}
              </div>
              {staleNotes.map(renderNote)}
            </>
          )}
        </div>
        <div
          style={{
            flexShrink: 0,
            padding: '0.8rem 1rem',
            borderTop: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ position: 'relative' }}>
            <CopyFeedbackTooltip visible={copied} align="end" size="comfortable" />
            <button
              className="button button-primary"
              disabled={notes.length === 0}
              onClick={() => copy(formatNotesForClipboard(notes))}
              type="button"
            >
              Copy
            </button>
          </div>
        </div>
      </ModalDialog>
      {/* A sibling after the list dialog, so it stacks on top of it (see ModalDialog). */}
      {confirmingDeleteStale && (
        <DeleteStaleNotesConfirmModal
          staleCount={deletableStaleCount}
          disabled={mutationDisabled}
          onCancel={() => setConfirmingDeleteStale(false)}
          onConfirm={() => {
            setConfirmingDeleteStale(false);
            onDeleteStaleNotes();
          }}
        />
      )}
    </>
  );
}
