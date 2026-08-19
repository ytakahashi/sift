import { useEffect, useId, useRef, type ReactElement } from 'react';

export interface ConfirmActionModalProps {
  /** Dialog header, and the dialog's accessible name. */
  title: string;
  /** Leading question, e.g. what exactly is about to happen. */
  message: string;
  /** Supporting lines, e.g. what is left untouched and irreversibility. */
  details?: string[];
  confirmLabel: string;
  /** Styles the confirm action as destructive. */
  danger?: boolean;
  /** Blocks confirming (e.g. while a mutation is in flight); cancelling stays available. */
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Disabled controls are excluded on purpose: the browser skips them when
 * tabbing, so treating one as the trap's last element would let Tab escape
 * into the page behind the dialog.
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Interaction shell for confirming a destructive action: focus trap, initial
 * focus on Cancel (so a stray Enter cannot confirm), Escape and backdrop
 * dismissal, and focus restored to whatever opened it. Callers supply only the
 * wording, so every confirmation in the app behaves identically.
 */
export function ConfirmActionModal(props: ConfirmActionModalProps): ReactElement {
  const { onCancel, onConfirm } = props;
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

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

  const details = props.details ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="confirm-action-backdrop"
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
        aria-labelledby={titleId}
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
          <span id={titleId} style={{ fontWeight: 600, fontSize: '0.9rem', color: '#c9d1d9' }}>
            {props.title}
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
          <p style={{ margin: details.length === 0 ? 0 : '0 0 0.6rem' }}>{props.message}</p>
          {details.map((detail, index) => (
            <p
              key={detail}
              style={{
                margin: index === details.length - 1 ? 0 : '0 0 0.6rem',
                color: '#8b949e',
                fontSize: '0.85rem',
              }}
            >
              {detail}
            </p>
          ))}
        </div>
        {/* Footer */}
        <div
          style={{
            padding: '0.8rem 1rem',
            borderTop: '1px solid #30363d',
            display: 'flex',
            fontSize: '0.9rem',
            justifyContent: 'flex-end',
            gap: '0.5rem',
          }}
        >
          <button ref={cancelButtonRef} className="button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className={props.danger === true ? 'button button-danger' : 'button'}
            disabled={props.disabled === true}
            onClick={() => void onConfirm()}
            type="button"
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
