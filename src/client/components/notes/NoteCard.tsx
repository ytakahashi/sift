import { useEffect, useState, type ReactElement } from 'react';
import { isLiveNote } from '../../../domain/notes/note-staleness';
import type { ReviewSession } from '../../../domain/notes/review-session';
import type { Note } from '../../../domain/notes/types';
import { NoteEditor } from './NoteEditor';
import { NoteViewer } from './NoteViewer';
import { NoteThread } from './NoteThread';

interface NoteCardProps {
  note: Note;
  review?: ReviewSession | null;
  contextLabel?: string;
  onUpdate?: (id: string, body: string) => Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  /** Disables Delete while another notes mutation is in flight. */
  deleteDisabled?: boolean;
  /**
   * Reports whether this card holds an open editor, so a container that can
   * unmount the card (the Source/Preview toggle) can block the switch instead
   * of discarding the draft. Must be referentially stable.
   */
  onEditorOpenChange?: (noteId: string, isOpen: boolean) => void;
}

export function NoteCard({
  note,
  review,
  contextLabel,
  onUpdate,
  onDelete,
  deleteDisabled,
  onEditorOpenChange,
}: NoteCardProps): ReactElement {
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    onEditorOpenChange?.(note.id, isEditing);
    // Unmounting while editing (a view switch, a diff refresh) has to release
    // the draft protection this card asked for.
    return () => onEditorOpenChange?.(note.id, false);
  }, [isEditing, note.id, onEditorOpenChange]);

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
        // Reserve the green border for live notes with outstanding feedback.
        border: `1px solid ${isLiveNote(note) && note.status !== 'resolved' ? '#3fb950' : '#484f58'}`,
        borderRadius: '4px',
      }}
    >
      {isEditing ? (
        <NoteEditor
          initialValue={note.body}
          contextLabel={contextLabel}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <NoteThread note={note} contextLabel={contextLabel}>
          <NoteViewer
            note={note}
            review={review}
            contextLabel={contextLabel}
            onEdit={() => setIsEditing(true)}
            onDelete={onDelete}
            deleteDisabled={deleteDisabled}
          />
        </NoteThread>
      )}
    </div>
  );
}
