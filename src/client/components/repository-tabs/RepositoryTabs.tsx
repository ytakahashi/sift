import type { ReactElement } from 'react';
import { X } from 'lucide-react';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { RepositoryTab } from '../../presentation/repository-tabs/repository-tab';
import type { DropPosition } from '../../presentation/reorder/reorder';
import { useTabDragReorder } from './useTabDragReorder';

export interface RepositoryTabsProps {
  tabs: RepositoryTab[];
  activeId: RepositoryId | null;
  onSelect: (id: RepositoryId) => void;
  onClose: (id: RepositoryId) => void;
  onMove: (sourceId: RepositoryId, targetId: RepositoryId, position: DropPosition) => void;
}

export function RepositoryTabs({
  tabs,
  activeId,
  onSelect,
  onClose,
  onMove,
}: RepositoryTabsProps): ReactElement | null {
  const { draggingId, dragOver, getTabDragProps } = useTabDragReorder({
    enabled: tabs.length > 1,
    onMove,
  });

  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav className="repository-tabs" aria-label="Open repositories">
      <ul className="repository-tab-list">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <li
              className={[
                'repository-tab-item',
                draggingId === tab.id && 'is-dragging',
                dragOver?.targetId === tab.id && `is-drop-${dragOver.position}`,
              ]
                .filter(Boolean)
                .join(' ')}
              key={tab.id}
              {...getTabDragProps(tab.id)}
            >
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
