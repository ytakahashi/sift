import { useState, type DragEvent } from 'react';
import type { RepositoryId } from '../../../domain/repository/repository';
import { resolveDropPosition, type DropPosition } from '../../presentation/reorder/reorder';

const TAB_DRAG_MIME_TYPE = 'application/x-sift-repository-tab';

interface DragOverState {
  targetId: RepositoryId;
  position: DropPosition;
}

interface TabDragProps {
  draggable: boolean;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDragLeave: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

interface UseTabDragReorderResult {
  draggingId: RepositoryId | null;
  dragOver: DragOverState | null;
  getTabDragProps: (id: RepositoryId) => TabDragProps;
}

export function useTabDragReorder({
  enabled,
  onMove,
}: {
  enabled: boolean;
  onMove: (sourceId: RepositoryId, targetId: RepositoryId, position: DropPosition) => void;
}): UseTabDragReorderResult {
  const [draggingId, setDraggingId] = useState<RepositoryId | null>(null);
  const [dragOver, setDragOver] = useState<DragOverState | null>(null);

  const clearDrag = (): void => {
    setDraggingId(null);
    setDragOver(null);
  };

  const getTabDragProps = (id: RepositoryId): TabDragProps => ({
    draggable: enabled,
    onDragStart: (event) => {
      if (!enabled) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      // Firefox requires drag data. A custom type keeps repository ids out of text drops.
      event.dataTransfer.setData(TAB_DRAG_MIME_TYPE, id);
      setDraggingId(id);
    },
    onDragOver: (event) => {
      // Only drags started in this tab bar may become a drop target.
      if (!enabled || draggingId === null || draggingId === id) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const rect = event.currentTarget.getBoundingClientRect();
      const position = resolveDropPosition(event.clientX, rect.left, rect.width);
      setDragOver((current) =>
        current?.targetId === id && current.position === position
          ? current
          : { targetId: id, position },
      );
    },
    onDragLeave: (event) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }
      setDragOver((current) => (current?.targetId === id ? null : current));
    },
    onDrop: (event) => {
      if (!enabled || draggingId === null || draggingId === id) {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const position = resolveDropPosition(event.clientX, rect.left, rect.width);
      onMove(draggingId, id, position);
      clearDrag();
    },
    onDragEnd: clearDrag,
  });

  return { draggingId, dragOver, getTabDragProps };
}
