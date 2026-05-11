import { useEffect, useRef, type ReactElement } from 'react';
import type { DiscardConfirmRequest } from '../../application/discard-confirm/discard-confirm-request';

type DiscardConfirmModalProps = DiscardConfirmRequest & {
  onCancel: () => void;
};

const TITLE_ID = 'discard-confirm-title';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function DiscardConfirmModal(props: DiscardConfirmModalProps): ReactElement {
  const { onCancel, onConfirm } = props;
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const message =
    props.mode === 'single'
      ? `Discard changes to "${props.fileName}"?`
      : 'Discard all working directory changes?';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 199,
        }}
      />
      {/* Modal panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '0.8rem 1rem',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span id={TITLE_ID} style={{ fontWeight: 600, fontSize: '0.9rem', color: '#c9d1d9' }}>
            Discard Changes
          </span>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              color: '#8b949e',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0.1rem 0.3rem',
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: '1.2rem 1rem', color: '#c9d1d9', fontSize: '0.9rem' }}>
          <p style={{ margin: '0 0 0.6rem' }}>{message}</p>
          <p style={{ margin: '0 0 0.6rem', color: '#8b949e', fontSize: '0.85rem' }}>
            Only unstaged changes will be discarded. Staged changes will remain intact.
          </p>
          <p style={{ margin: 0, color: '#8b949e', fontSize: '0.85rem' }}>
            This action cannot be undone.
          </p>
        </div>
        {/* Footer */}
        <div
          style={{
            padding: '0.8rem 1rem',
            borderTop: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <button ref={cancelButtonRef} className="button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="button button-danger" onClick={() => void onConfirm()} type="button">
            Discard
          </button>
        </div>
      </div>
    </>
  );
}
