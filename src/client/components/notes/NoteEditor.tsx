import { useState, type ReactElement } from 'react';

interface NoteEditorProps {
  initialValue?: string;
  contextLabel?: string;
  /**
   * Resolves when the note is persisted; the caller closes the editor only
   * then. On rejection the editor keeps the draft and shows the error inline
   * (this is the only place where the unsaved input can be protected).
   */
  onSave: (val: string) => Promise<void>;
  onCancel: () => void;
}

export function NoteEditor({
  initialValue = '',
  contextLabel,
  onSave,
  onCancel,
}: NoteEditorProps): ReactElement {
  const [val, setVal] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await onSave(val);
    } catch (error: unknown) {
      // Server 422 messages carry recovery hints (file-note fallback, bucket
      // selection); show them verbatim next to the preserved draft.
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#161b22',
        padding: '0.5rem',
        borderRadius: '6px',
        border: '1px solid #30363d',
        margin: '4px 0',
      }}
    >
      {contextLabel && (
        <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
          {contextLabel}
        </div>
      )}
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          backgroundColor: '#0d1117',
          color: '#c9d1d9',
          border: '1px solid #30363d',
          borderRadius: '4px',
          padding: '0.4rem',
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
        placeholder="Add a note..."
        autoFocus
      />
      {errorMessage && (
        <div
          role="alert"
          style={{
            color: '#f85149',
            fontSize: '0.78rem',
            marginTop: '0.3rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {errorMessage}
        </div>
      )}
      <div
        style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}
      >
        <button className="button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="button button-primary"
          disabled={isSaving}
          onClick={() => void handleSave()}
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
}
