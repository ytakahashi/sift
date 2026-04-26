import { useState, useEffect, type ReactElement } from 'react';
import type { Note } from '../../../domain/notes/types';
import { formatNotesForClipboard } from '../../../domain/notes/format';

interface NotesListModalProps {
  notes: Note[];
  onClose: () => void;
  onDeleteNote: (id: string) => void;
  resolveFilePath: (fileId: string) => string;
}

export function NotesListModal({
  notes,
  onClose,
  onDeleteNote,
  resolveFilePath,
}: NotesListModalProps): ReactElement {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async (): Promise<void> => {
    const text = formatNotesForClipboard(notes, resolveFilePath);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (e) {
      if (e instanceof Error) {
        console.error('Failed to copy notes:', e.message);
      }
    }
  };

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
        style={{
          position: 'absolute',
          top: '40px',
          right: '1rem',
          width: '500px',
          maxHeight: 'calc(100vh - 60px)',
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
          style={{
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {notes.map((note) => {
            const filePath = resolveFilePath(note.target.fileId);
            return (
              <div
                key={note.id}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}
              >
                <div style={{ fontSize: '0.8rem', color: '#c9d1d9' }}>
                  {filePath}#L{note.target.startNewLineNumber}
                </div>
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
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      style={{
                        background: 'transparent',
                        color: '#f85149',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '0.75rem',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            padding: '0.8rem 1rem',
            borderTop: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ position: 'relative' }}>
            {copied && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  right: 0,
                  backgroundColor: '#373434ff',
                  color: '#ffffff',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap',
                  animation: 'fadeIn 0.2s ease-in-out',
                }}
              >
                Copied!
              </span>
            )}
            <button
              onClick={() => void handleCopy()}
              style={{
                background: '#238636',
                color: '#fff',
                border: 'none',
                padding: '0.3rem 0.8rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
