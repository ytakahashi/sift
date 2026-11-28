import type { ReactElement } from 'react';
import { ConfirmActionModal } from '../confirm-action/ConfirmActionModal';

interface DeleteStaleNotesConfirmModalProps {
  /**
   * Currently deletable stale notes. The server rechecks eligibility when
   * the request arrives, so the actual number removed can differ.
   */
  staleCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  /** Blocks confirming while another notes mutation is in flight. */
  disabled?: boolean;
}

export function DeleteStaleNotesConfirmModal({
  staleCount,
  onCancel,
  onConfirm,
  disabled = false,
}: DeleteStaleNotesConfirmModalProps): ReactElement {
  return (
    <ConfirmActionModal
      title="Delete Stale Notes"
      message={`Delete ${staleCount} stale ${staleCount === 1 ? 'note' : 'notes'}?`}
      details={[
        'Only stale notes without review protection will be deleted.',
        'This action cannot be undone.',
      ]}
      confirmLabel="Delete"
      danger
      disabled={disabled}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
