import type { CSSProperties, ReactElement } from 'react';

type Align = 'center' | 'end';
type Size = 'compact' | 'comfortable';

interface CopyFeedbackTooltipProps {
  visible: boolean;
  /** Position relative to the trigger: center = centered above it, end = right-aligned above it. */
  align: Align;
  /** Visual scale: compact = NoteViewer's copy button, comfortable = NotesListModal's footer copy-all. */
  size: Size;
}

const ALIGN_STYLE: Record<Align, CSSProperties> = {
  center: { bottom: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)' },
  end: { bottom: 'calc(100% + 8px)', right: 0 },
};

const SIZE_STYLE: Record<Size, CSSProperties> = {
  compact: { padding: '0.2rem 0.4rem' },
  comfortable: { padding: '0.4rem 0.6rem', fontSize: '0.75rem' },
};

/**
 * Floating "Copied!" tooltip shown above a copy trigger. align/size are a
 * closed set matching the two current call sites (NoteViewer, NotesListModal
 * footer) rather than free-form style props, so a future caller can't
 * reintroduce style drift between them.
 */
export function CopyFeedbackTooltip({
  visible,
  align,
  size,
}: CopyFeedbackTooltipProps): ReactElement | null {
  if (!visible) {
    return null;
  }

  return (
    <span
      style={{
        position: 'absolute',
        backgroundColor: '#373434ff',
        color: '#ffffff',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
        animation: 'fadeIn 0.2s ease-in-out',
        ...ALIGN_STYLE[align],
        ...SIZE_STYLE[size],
      }}
    >
      Copied!
    </span>
  );
}
