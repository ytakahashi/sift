import type { ReactElement } from 'react';
import type { Note } from '../../../domain/notes/types';
import { describeNoteStaleReason, formatNoteForClipboard } from '../../../domain/notes/format';
import { CopyFeedbackTooltip } from './CopyFeedbackTooltip';
import { NoteActionButton } from './NoteActionButton';
import { useCopyFeedback } from './useCopyFeedback';

interface NoteViewerProps {
  note: Note;
  contextLabel?: string;
  onEdit: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  /** Disables Delete while another notes mutation is in flight. */
  deleteDisabled?: boolean;
}

export function NoteViewer({
  note,
  contextLabel,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: NoteViewerProps): ReactElement {
  const { copied, copy } = useCopyFeedback();

  return (
    <>
      {contextLabel && (
        <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
          {contextLabel}
        </div>
      )}
      {note.staleness.kind === 'stale' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.4rem',
            marginBottom: '0.35rem',
            fontSize: '0.72rem',
            color: '#8b949e',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              padding: '0 0.35rem',
              border: '1px solid #484f58',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Stale
          </span>
          <span>{describeNoteStaleReason(note.staleness.reason)}</span>
        </div>
      )}
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
        <NoteActionButton label="Edit" onClick={onEdit} variant="link" />
        <div style={{ position: 'relative' }}>
          <CopyFeedbackTooltip visible={copied} align="center" size="compact" />
          <NoteActionButton
            label="Copy"
            onClick={() => copy(formatNoteForClipboard(note))}
            variant="muted"
          />
        </div>
        <NoteActionButton
          label="Delete"
          onClick={() => void onDelete?.(note.id)}
          variant="danger"
          disabled={deleteDisabled}
        />
      </div>
    </>
  );
}
