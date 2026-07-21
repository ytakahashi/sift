import type { ReactElement } from 'react';

type Variant = 'link' | 'muted' | 'danger';

interface NoteActionButtonProps {
  label: string;
  onClick: () => void;
  variant: Variant;
  /** Disables the button (e.g. while another notes mutation is in flight). */
  disabled?: boolean;
}

const VARIANT_COLOR: Record<Variant, string> = {
  link: '#79c0ff',
  muted: '#8b949e',
  danger: '#f85149',
};

/** Shared text-style action button for NoteViewer's Edit/Copy/Delete and NotesListModal's Delete. */
export function NoteActionButton({
  label,
  onClick,
  variant,
  disabled = false,
}: NoteActionButtonProps): ReactElement {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        background: 'transparent',
        color: VARIANT_COLOR[variant],
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
        fontSize: '0.75rem',
      }}
    >
      {label}
    </button>
  );
}
