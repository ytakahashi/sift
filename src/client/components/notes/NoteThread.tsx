import type { ReactElement, ReactNode } from 'react';
import type { Note, NoteAuthor } from '../../../domain/notes/types';

interface NoteThreadProps {
  note: Note;
  contextLabel?: string;
  children: ReactNode;
}

function authorLabel(author: NoteAuthor): string {
  return author.client ? `${author.role} (${author.client})` : author.role;
}

export function NoteThread({ note, contextLabel, children }: NoteThreadProps): ReactElement {
  const content = (
    <>
      {note.reviewId && note.author && (
        <div className="note-thread-author">{authorLabel(note.author)}</div>
      )}
      {children}
      {note.replies && note.replies.length > 0 && (
        <ol className="note-thread-replies" aria-label="Replies">
          {note.replies.map((reply, index) => (
            <li key={index} className="note-thread-reply">
              <div className="note-thread-author">
                {authorLabel(reply.author)}
                {reply.resolution && <> · {reply.resolution}</>}
              </div>
              <div className="note-thread-reply-body">{reply.body}</div>
            </li>
          ))}
        </ol>
      )}
    </>
  );

  if (note.status !== 'resolved') {
    return content;
  }

  return (
    <details className="note-thread-resolved">
      <summary>
        Resolved{contextLabel && <> · {contextLabel}</>}
        <span className="note-thread-preview"> · {note.body.trim().split('\n', 1)[0]}</span>
      </summary>
      {content}
    </details>
  );
}
