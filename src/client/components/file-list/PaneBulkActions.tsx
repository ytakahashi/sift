import type { ReactElement } from 'react';

interface PaneBulkAction {
  label: string;
  onClick: () => void;
}

interface PaneBulkActionsProps {
  actions: PaneBulkAction[];
  disabled: boolean;
}

export function PaneBulkActions({ actions, disabled }: PaneBulkActionsProps): ReactElement {
  return (
    <div className="pane-footer">
      {actions.map((action) => (
        <button
          key={action.label}
          className="button pane-bulk-action-button"
          disabled={disabled}
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
