import type { ReactElement } from 'react';

interface PaneBulkAction {
  label: string;
  tone: 'success' | 'danger';
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
          className={`bulk-action-button bulk-action-button-${action.tone}`}
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
