import { useEffect, useState } from 'react';
import type { Note } from '../../../domain/notes/types';
import { formatNoteForClipboard } from '../../../domain/notes/format';
import { NoteEditor } from './NoteEditor';

interface NoteCardProps {
  note: Note;
  resolveFilePath: (fileId: string) => string;
  onUpdate?: (id: string, body: string) => void;
  onDelete?: (id: string) => void;
}

export function NoteCard({ note, resolveFilePath, onUpdate, onDelete }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-clear the "Copied!" feedback after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    const text = formatNoteForClipboard(note, resolveFilePath);
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
    });
  };

  const handleSave = (val: string) => {
    if (val.trim()) {
      onUpdate?.(note.id, val);
    }
    setIsEditing(false);
  };

  return (
    <div
      style={{
        padding: '0.5rem',
        backgroundColor: '#161b22',
        border: '1px solid #3fb950',
        borderRadius: '4px',
      }}
    >
      {isEditing ? (
        /* Edit mode: inline editor */
        <NoteEditor
          initialValue={note.body}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        /* View mode: body and action buttons */
        <>
          <div style={{ whiteSpace: 'pre-wrap', color: '#c9d1d9' }}>{note.body}</div>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '0.3rem',
              fontSize: '0.75rem',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setIsEditing(true)}
              style={{
                background: 'transparent',
                color: '#79c0ff',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Edit
            </button>
            <div style={{ position: 'relative' }}>
              {copied && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 4px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#373434ff',
                    color: '#ffffff',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    animation: 'fadeIn 0.2s ease-in-out',
                  }}
                >
                  Copied!
                </span>
              )}
              <button
                onClick={handleCopy}
                style={{
                  background: 'transparent',
                  color: '#8b949e',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => onDelete?.(note.id)}
              style={{
                background: 'transparent',
                color: '#f85149',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
