import { useId, useRef, useState, type ReactElement } from 'react';
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
import { useCopyFeedback } from './useCopyFeedback';

interface NotesListModalProps {
  notes: Note[];
  onClose: () => void;
  onDeleteNote: (id: string) => void | Promise<void>;
  /** Deletes every note the server still considers stale, in one request. */
  onDeleteStaleNotes: () => void;
  /** Jumps to the note's file/pane in the main diff pane. */
  onSelectLocation: (note: Note) => void;
  /** Whether the note currently has a destination in the main diff pane. */
  canSelectLocation: (note: Note) => boolean;
  onAddNote: (path: string, body: string) => Promise<void>;
  /** Disables both deletions while another notes mutation is in flight. */
  mutationDisabled?: boolean;
}

export function NotesListModal({
  notes,
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
  // The confirmation is about the notes that are stale right now. If the last
  // one recovers (file restored) or another client deletes it while the dialog
  // is open, there is nothing left to confirm.
  if (confirmingDeleteStale && staleNotes.length === 0) {
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
            border: `1px solid ${stale ? '#484f58' : '#3fb950'}`,
            borderRadius: '4px',
            padding: '0.5rem',
          }}
        >
          {note.staleness.kind === 'stale' && (
            <div style={{ color: '#8b949e', fontSize: '0.72rem', marginBottom: '0.35rem' }}>
              {describeNoteStaleReason(note.staleness.reason)}
            </div>
          )}
          <div style={{ whiteSpace: 'pre-wrap', color: '#c9d1d9', fontSize: '0.85rem' }}>
            {note.body}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <NoteActionButton
              label="Delete"
              onClick={() => void onDeleteNote(note.id)}
              variant="danger"
              disabled={mutationDisabled}
            />
          </div>
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
                <span>Stale ({staleNotes.length})</span>
                <NoteActionButton
                  label="Delete stale notes"
                  onClick={() => setConfirmingDeleteStale(true)}
                  variant="danger"
                  disabled={mutationDisabled}
                />
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
          staleCount={staleNotes.length}
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
