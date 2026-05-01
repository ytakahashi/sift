export type DiscardConfirmRequest =
  | { mode: 'single'; fileName: string; onConfirm: () => void | Promise<void> }
  | { mode: 'all'; onConfirm: () => void | Promise<void> };
