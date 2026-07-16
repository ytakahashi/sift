import { useState, type ReactElement } from 'react';
import type { Note } from '../../../domain/notes/types';
import { NoteEditor } from './NoteEditor';
import { NoteViewer } from './NoteViewer';

interface NoteCardProps {
  note: Note;
  resolveFilePath: (fileId: string) => string;
  onUpdate?: (id: string, body: string) => Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  /** Disables Delete while another notes mutation is in flight. */
  deleteDisabled?: boolean;
}

export function NoteCard({
  note,
  resolveFilePath,
  onUpdate,
  onDelete,
  deleteDisabled,
}: NoteCardProps): ReactElement {
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async (val: string): Promise<void> => {
    if (val.trim()) {
      // A rejection propagates to NoteEditor, which keeps the draft and shows
      // the error; the editor is closed only after the update succeeded.
      await onUpdate?.(note.id, val);
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
        <NoteEditor
          initialValue={note.body}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <NoteViewer
          note={note}
          resolveFilePath={resolveFilePath}
          onEdit={() => setIsEditing(true)}
          onDelete={onDelete}
          deleteDisabled={deleteDisabled}
        />
      )}
    </div>
  );
}
