import { useState, type ReactElement } from 'react';

interface NoteEditorProps {
  initialValue?: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}

export function NoteEditor({ initialValue = '', onSave, onCancel }: NoteEditorProps): ReactElement {
  const [val, setVal] = useState(initialValue);

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
      <div
        style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}
      >
        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            padding: '0.2rem 0.6rem',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(val)}
          style={{
            background: '#238636',
            color: '#fff',
            border: 'none',
            padding: '0.2rem 0.6rem',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
