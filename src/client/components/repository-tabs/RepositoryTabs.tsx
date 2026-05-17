import type { ReactElement } from 'react';
import { X } from 'lucide-react';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { RepositoryTab } from '../../presentation/repository-tabs/repository-tab';

export interface RepositoryTabsProps {
  tabs: RepositoryTab[];
  activeId: RepositoryId | null;
  onSelect: (id: RepositoryId) => void;
  onClose: (id: RepositoryId) => void;
}

export function RepositoryTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
}: RepositoryTabsProps): ReactElement | null {
  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav className="repository-tabs" aria-label="Open repositories">
      <ul className="repository-tab-list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <li className="repository-tab-item" key={tab.id}>
              <button
                className="repository-tab"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(tab.id)}
                title={tab.name}
                type="button"
              >
                <span className="repository-tab-label">{tab.name}</span>
              </button>
              <button
                className="repository-tab-close"
                aria-label={`Close ${tab.name}`}
                onClick={() => onClose(tab.id)}
                type="button"
              >
                <X aria-hidden="true" size={14} strokeWidth={1.8} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
