import type { ReactElement } from 'react';
import type { DiscardConfirmRequest } from '../../application/discard-confirm/discard-confirm-request';
import { ConfirmActionModal } from '../confirm-action/ConfirmActionModal';

type DiscardConfirmModalProps = DiscardConfirmRequest & {
  onCancel: () => void;
};

export function DiscardConfirmModal(props: DiscardConfirmModalProps): ReactElement {
  const message =
    props.mode === 'single'
      ? `Discard changes to "${props.fileName}"?`
      : 'Discard all working directory changes?';

  return (
    <ConfirmActionModal
      title="Discard Changes"
      message={message}
      details={[
        'Only unstaged changes will be discarded. Staged changes will remain intact.',
        'This action cannot be undone.',
      ]}
      confirmLabel="Discard"
      danger
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    />
  );
}
