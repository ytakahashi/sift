import type { ReactElement } from 'react';
import { ConfirmActionModal } from '../confirm-action/ConfirmActionModal';

interface DeleteStaleNotesConfirmModalProps {
  /**
   * Stale notes shown right now. It is what the reader sees, not a promise:
   * the server re-derives staleness when the request arrives, so the wording
   * says which notes go rather than guaranteeing this many will.
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
        'Only notes that are still stale will be deleted. Live notes will remain.',
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
