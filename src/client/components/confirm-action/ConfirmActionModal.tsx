import { useId, useRef, type ReactElement } from 'react';
import { ModalDialog } from '../modal/ModalDialog';

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
 * Confirmation content keeps initial focus on Cancel so a stray Enter cannot
 * confirm. The shared dialog owns dismissal and focus management.
 */
export function ConfirmActionModal(props: ConfirmActionModalProps): ReactElement {
  const { onCancel, onConfirm } = props;
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const details = props.details ?? [];

  return (
    <ModalDialog
      titleId={titleId}
      initialFocusRef={cancelButtonRef}
      onClose={onCancel}
      panelStyle={{ width: '420px' }}
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
    </ModalDialog>
  );
}
