import type { ReactElement } from 'react';
import type { Note } from '../../../domain/notes/types';
import { formatNoteLocation, formatNotesForClipboard } from '../../../domain/notes/format';
import { CopyFeedbackTooltip } from './CopyFeedbackTooltip';
import { NoteActionButton } from './NoteActionButton';
import { useCopyFeedback } from './useCopyFeedback';

interface NotesListModalProps {
  notes: Note[];
  onClose: () => void;
  onDeleteNote: (id: string) => void | Promise<void>;
  /** Jumps to the note's file/pane in the main diff pane. */
  onSelectLocation: (note: Note) => void;
  /** Disables Delete while another notes mutation is in flight. */
  deleteDisabled?: boolean;
}

export function NotesListModal({
  notes,
  onClose,
  onDeleteNote,
  onSelectLocation,
  deleteDisabled = false,
}: NotesListModalProps): ReactElement {
  const { copied, copy } = useCopyFeedback();

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99,
        }}
      />
      {/* Modal panel */}
      <div
        data-testid="notes-modal-panel"
        style={{
          position: 'absolute',
          top: '40px',
          right: '1rem',
          width: '500px',
          maxHeight: 'calc(100% - 60px)',
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
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
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Your Notes ({notes.length})</span>
          <button
            onClick={onClose}
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
          {notes.map((note) => {
            const location = formatNoteLocation(note);
            return (
              <div
                key={note.id}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
              >
                <button
                  onClick={() => onSelectLocation(note)}
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: '#c9d1d9',
                  }}
                >
                  {location}
                </button>
                <div
                  style={{
                    backgroundColor: '#0d1117',
                    border: '1px solid #3fb950',
                    borderRadius: '4px',
                    padding: '0.5rem',
                  }}
                >
                  <div style={{ whiteSpace: 'pre-wrap', color: '#c9d1d9', fontSize: '0.85rem' }}>
                    {note.body}
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <NoteActionButton
                      label="Delete"
                      onClick={() => void onDeleteNote(note.id)}
                      variant="danger"
                      disabled={deleteDisabled}
                    />
                  </div>
                </div>
              </div>
            );
          })}
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
              onClick={() => copy(formatNotesForClipboard(notes))}
              type="button"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
