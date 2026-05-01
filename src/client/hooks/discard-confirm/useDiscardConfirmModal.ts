import { useCallback, useState } from 'react';
import type { DiscardConfirmRequest } from '../../application/discard-confirm/discard-confirm-request';

export type { DiscardConfirmRequest };

interface UseDiscardConfirmModalResult {
  pendingRequest: DiscardConfirmRequest | null;
  requestConfirmation: (req: DiscardConfirmRequest) => void;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export function useDiscardConfirmModal(): UseDiscardConfirmModalResult {
  const [pendingRequest, setPendingRequest] = useState<DiscardConfirmRequest | null>(null);

  const requestConfirmation = useCallback((req: DiscardConfirmRequest): void => {
    setPendingRequest(req);
  }, []);

  const handleConfirm = useCallback((): void => {
    void pendingRequest?.onConfirm();
    setPendingRequest(null);
  }, [pendingRequest]);

  const handleCancel = useCallback((): void => {
    setPendingRequest(null);
  }, []);

  return { pendingRequest, requestConfirmation, handleConfirm, handleCancel };
}
