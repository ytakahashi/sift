import { useState, type FormEvent, type ReactElement } from 'react';

interface FileNoteCreateFormProps {
  disabled?: boolean;
  onSave: (path: string, body: string) => Promise<void>;
}

export function FileNoteCreateForm({
  disabled = false,
  onSave,
}: FileNoteCreateFormProps): ReactElement {
  const [path, setPath] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submissionDisabled = disabled || isSaving || path.trim() === '' || body.trim() === '';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submissionDisabled) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      // Paths are exact Git identities, so discard surrounding whitespace
      // commonly introduced by pasting while preserving the note body as-is.
      await onSave(path.trim(), body);
      setPath('');
      setBody('');
    } catch (error: unknown) {
      // The server explains why a path is not a valid note target. Keep both
      // inputs intact so the user can correct the path or retry without losing
      // the review comment they already wrote.
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      aria-label="Add file note"
      onSubmit={(event) => void handleSubmit(event)}
      style={{
        backgroundColor: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '0.65rem',
      }}
    >
      <div style={{ color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 600 }}>Add file note</div>
      <input
        aria-label="File path"
        disabled={disabled || isSaving}
        onChange={(event) => setPath(event.target.value)}
        placeholder="Repository-relative path"
        style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '4px',
          color: '#c9d1d9',
          fontFamily: 'inherit',
          padding: '0.4rem',
        }}
        type="text"
        value={path}
      />
      <textarea
        aria-label="Note body"
        disabled={disabled || isSaving}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a note..."
        rows={3}
        style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '4px',
          color: '#c9d1d9',
          fontFamily: 'inherit',
          padding: '0.4rem',
          resize: 'vertical',
        }}
        value={body}
      />
      {errorMessage && (
        <div role="alert" style={{ color: '#f85149', fontSize: '0.78rem', whiteSpace: 'pre-wrap' }}>
          {errorMessage}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="button button-primary" disabled={submissionDisabled} type="submit">
          Add note
        </button>
      </div>
    </form>
  );
}
