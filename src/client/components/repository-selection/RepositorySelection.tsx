import { useState, type DragEvent, type FormEvent, type ReactElement } from 'react';
import { GripVertical, X } from 'lucide-react';
import type {
  InvalidRepository,
  RepositoryId,
  RepositoryList,
  ResolvedRepository,
} from '../../../domain/repository/repository';
import { AppHeader } from '../app-header/AppHeader';

export interface RepositorySelectionProps {
  addError: string | null;
  adding: boolean;
  configMissingError: string | null;
  editError: string | null;
  error: string | null;
  loading: boolean;
  onAddRepository: (path: string) => Promise<boolean>;
  onCommitRepositoryListEdits: (
    deleteIds: RepositoryId[],
    orderedIds: RepositoryId[],
  ) => Promise<boolean>;
  onRefresh: () => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  repositories: RepositoryList | null;
  saving: boolean;
  clearEditError: () => void;
}

function RepositoryRow({
  dragOverPosition,
  dragging,
  isEditing,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onToggleDelete,
  onSelectRepository,
  pendingDelete,
  repository,
  saving,
}: {
  dragOverPosition: 'before' | 'after' | null;
  dragging: boolean;
  isEditing: boolean;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLLIElement>, repoId: RepositoryId) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>, repoId: RepositoryId) => void;
  onDrop: (event: DragEvent<HTMLLIElement>, repoId: RepositoryId) => void;
  onToggleDelete: (repoId: RepositoryId) => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  pendingDelete: boolean;
  repository: ResolvedRepository;
  saving: boolean;
}): ReactElement {
  const draggable = isEditing && !pendingDelete && !saving;
  const content = (
    <button
      className="repository-button"
      disabled={isEditing}
      onClick={() => {
        if (!isEditing) {
          onSelectRepository(repository.id);
        }
      }}
      title={repository.path}
      type="button"
    >
      <span className="repository-name">{repository.name}</span>
      <span className="repository-path">{repository.path}</span>
    </button>
  );

  // Drag handlers are supplied unconditionally by the parent to keep row
  // rendering simple, but they are intentionally unused outside Edit mode.
  if (!isEditing) {
    return <li className="repository-item">{content}</li>;
  }

  const dragOverClass = dragOverPosition ? ` repository-item-drag-over-${dragOverPosition}` : '';

  return (
    <li
      aria-grabbed={dragging}
      className={`repository-item repository-editing-item repository-reorderable-item${
        pendingDelete ? ' repository-item-pending-delete' : ''
      }${dragging ? ' repository-item-dragging' : ''}${dragOverClass}`}
      draggable={draggable}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, repository.id)}
      onDragStart={(event) => onDragStart(event, repository.id)}
      onDrop={(event) => onDrop(event, repository.id)}
    >
      <button
        aria-label={`Drag ${repository.name}`}
        className="repository-drag-handle"
        disabled={!draggable}
        title={`Drag ${repository.path}`}
        type="button"
      >
        <GripVertical size={16} />
      </button>
      {content}
      <button
        aria-label={`${pendingDelete ? 'Undo remove' : 'Remove'} ${repository.name}`}
        aria-pressed={pendingDelete}
        className="repository-delete-button"
        disabled={saving}
        onClick={() => onToggleDelete(repository.id)}
        title={`${pendingDelete ? 'Undo remove' : 'Remove'} ${repository.path}`}
        type="button"
      >
        <X size={16} />
      </button>
    </li>
  );
}

function InvalidRepositoryRow({
  isEditing,
  onToggleDelete,
  pendingDelete,
  repository,
  saving,
}: {
  isEditing: boolean;
  onToggleDelete: (repoId: RepositoryId) => void;
  pendingDelete: boolean;
  repository: InvalidRepository;
  saving: boolean;
}): ReactElement {
  const content = (
    <div className="repository-item-content" title={repository.path}>
      <span className="repository-name">{repository.name}</span>
      <span className="repository-path">{repository.path}</span>
      <span className="repository-error">{repository.reason}</span>
    </div>
  );

  if (!isEditing) {
    return <li className="repository-item repository-item-invalid">{content}</li>;
  }

  return (
    <li
      className={`repository-item repository-item-invalid repository-editing-item${
        pendingDelete ? ' repository-item-pending-delete' : ''
      }`}
    >
      {content}
      <button
        aria-label={`${pendingDelete ? 'Undo remove' : 'Remove'} ${repository.name}`}
        aria-pressed={pendingDelete}
        className="repository-delete-button"
        disabled={saving}
        onClick={() => onToggleDelete(repository.id)}
        title={`${pendingDelete ? 'Undo remove' : 'Remove'} ${repository.path}`}
        type="button"
      >
        <X size={16} />
      </button>
    </li>
  );
}

export function RepositorySelection({
  addError,
  adding,
  configMissingError,
  editError,
  error,
  loading,
  onAddRepository,
  onCommitRepositoryListEdits,
  onRefresh,
  onSelectRepository,
  repositories,
  saving,
  clearEditError,
}: RepositorySelectionProps): ReactElement {
  const [isAddingRepository, setIsAddingRepository] = useState(false);
  const [isEditingRepositoryList, setIsEditingRepositoryList] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<RepositoryId>>(new Set());
  const [pendingOrder, setPendingOrder] = useState<RepositoryId[] | null>(null);
  const [draggingId, setDraggingId] = useState<RepositoryId | null>(null);
  const [dragOverId, setDragOverId] = useState<RepositoryId | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const [repositoryPath, setRepositoryPath] = useState('');
  const items = repositories?.repositories ?? [];
  const invalidItems = repositories?.invalidRepositories ?? [];
  const orderedItems = orderRepositories(items, pendingOrder);
  const itemCount = items.length + invalidItems.length;
  const trimmedRepositoryPath = repositoryPath.trim();
  const canSubmitRepository = trimmedRepositoryPath.length > 0 && !adding;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canSubmitRepository) {
      return;
    }

    const added = await onAddRepository(trimmedRepositoryPath);
    if (added) {
      setRepositoryPath('');
      setIsAddingRepository(false);
    }
  };

  const handleToggleDelete = (repoId: RepositoryId): void => {
    setPendingDeleteIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(repoId)) {
        nextIds.delete(repoId);
      } else {
        nextIds.add(repoId);
      }
      return nextIds;
    });
  };

  const handleEditAction = async (): Promise<void> => {
    if (!isEditingRepositoryList) {
      setPendingDeleteIds(new Set());
      setPendingOrder(items.map((repository) => repository.id));
      setDraggingId(null);
      setDragOverId(null);
      setDropPosition('before');
      clearEditError();
      setIsEditingRepositoryList(true);
      return;
    }

    const currentOrder = pendingOrder ?? items.map((repository) => repository.id);
    const remainingIds = currentOrder.filter((id) => !pendingDeleteIds.has(id));
    const originalRemainingIds = items
      .filter((repository) => !pendingDeleteIds.has(repository.id))
      .map((repository) => repository.id);
    const hasReorderChanged =
      remainingIds.length !== originalRemainingIds.length ||
      remainingIds.some((id, index) => id !== originalRemainingIds[index]);

    if (pendingDeleteIds.size === 0 && !hasReorderChanged) {
      clearEditError();
      setPendingOrder(null);
      setIsEditingRepositoryList(false);
      return;
    }

    const deleteIds = [...pendingDeleteIds];
    const committed = await onCommitRepositoryListEdits(
      deleteIds,
      hasReorderChanged ? remainingIds : [],
    );
    // Drop the pending marks regardless of outcome: the hook has already
    // refreshed the list against the latest config, so successfully removed
    // entries are gone and any remaining ones should appear unmarked. Keeping
    // the old pending state would show stale strike-through on rows that no
    // longer exist or that the user may have changed their mind about.
    setPendingDeleteIds(new Set());
    setPendingOrder(null);
    setDraggingId(null);
    setDragOverId(null);
    setDropPosition('before');

    if (!committed) {
      return;
    }

    setIsEditingRepositoryList(false);
  };

  const handleCancelEdit = (): void => {
    setPendingDeleteIds(new Set());
    setPendingOrder(null);
    setDraggingId(null);
    setDragOverId(null);
    setDropPosition('before');
    clearEditError();
    setIsEditingRepositoryList(false);
  };

  const handleDragStart = (event: DragEvent<HTMLLIElement>, repoId: RepositoryId): void => {
    if (saving || pendingDeleteIds.has(repoId)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', repoId);
    setDraggingId(repoId);
  };

  const handleDragOver = (event: DragEvent<HTMLLIElement>, repoId: RepositoryId): void => {
    const sourceId = draggingId ?? event.dataTransfer.getData('text/plain');
    if (
      !sourceId ||
      sourceId === repoId ||
      pendingDeleteIds.has(sourceId) ||
      pendingDeleteIds.has(repoId)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const target = (event.currentTarget || event.target) as HTMLElement;
    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = event.clientY < midY ? 'before' : 'after';

    setDragOverId(repoId);
    setDropPosition(position);
  };

  const handleDrop = (event: DragEvent<HTMLLIElement>, repoId: RepositoryId): void => {
    event.preventDefault();
    const sourceId = draggingId ?? event.dataTransfer.getData('text/plain');
    if (
      sourceId &&
      sourceId !== repoId &&
      !pendingDeleteIds.has(sourceId) &&
      !pendingDeleteIds.has(repoId)
    ) {
      setPendingOrder((currentOrder) =>
        moveRepository(
          currentOrder ?? items.map((repository) => repository.id),
          sourceId,
          repoId,
          dropPosition,
        ),
      );
    }
    setDraggingId(null);
    setDragOverId(null);
    setDropPosition('before');
  };

  const handleDragEnd = (): void => {
    setDraggingId(null);
    setDragOverId(null);
    setDropPosition('before');
  };

  return (
    <div className="app-container">
      {/* Fetch errors mean the latest repository list is unknown, so show
      them ahead of config-state messages derived from older or partial data. */}
      <AppHeader
        errorMessage={error || configMissingError}
        actions={
          <button className="secondary-button" disabled={saving} onClick={onRefresh} type="button">
            Refresh
          </button>
        }
      />
      <main className="repository-selection-main scroll-area">
        <section className="repository-selection-content">
          <div className="repository-selection-heading">
            <h1>Repositories</h1>
            <span>{loading ? 'Loading...' : `${itemCount} configured`}</span>
          </div>
          {itemCount > 0 ? (
            <ul className="repository-list">
              {orderedItems.map((repository) => (
                <RepositoryRow
                  dragOverPosition={dragOverId === repository.id ? dropPosition : null}
                  dragging={draggingId === repository.id}
                  isEditing={isEditingRepositoryList}
                  key={repository.id}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onToggleDelete={handleToggleDelete}
                  onSelectRepository={onSelectRepository}
                  pendingDelete={pendingDeleteIds.has(repository.id)}
                  repository={repository}
                  saving={saving}
                />
              ))}
              {invalidItems.map((repository) => (
                <InvalidRepositoryRow
                  isEditing={isEditingRepositoryList}
                  key={repository.id}
                  onToggleDelete={handleToggleDelete}
                  pendingDelete={pendingDeleteIds.has(repository.id)}
                  repository={repository}
                  saving={saving}
                />
              ))}
            </ul>
          ) : (
            <div className="repository-empty">
              {loading ? 'Loading repositories...' : 'No repositories available.'}
            </div>
          )}
          <div className="repository-actions">
            {!isAddingRepository && (
              <>
                <button
                  className="secondary-button"
                  disabled={loading || isEditingRepositoryList || saving}
                  onClick={() => setIsAddingRepository(true)}
                  type="button"
                >
                  Add Repository
                </button>
                {(itemCount > 0 || isEditingRepositoryList) && (
                  <button
                    className="secondary-button"
                    disabled={loading || saving}
                    onClick={() => void handleEditAction()}
                    type="button"
                  >
                    {isEditingRepositoryList
                      ? saving
                        ? 'Saving...'
                        : 'Done'
                      : 'Edit Repository List'}
                  </button>
                )}
                {isEditingRepositoryList && (
                  <button
                    className="secondary-button"
                    disabled={saving}
                    onClick={handleCancelEdit}
                    type="button"
                  >
                    Cancel edit
                  </button>
                )}
              </>
            )}
            {isAddingRepository && (
              <form className="repository-add-form" onSubmit={(event) => void handleSubmit(event)}>
                <input
                  aria-label="Repository path"
                  className="repository-add-input"
                  disabled={adding}
                  onChange={(event) => setRepositoryPath(event.target.value)}
                  placeholder="/Users/example/work/sift"
                  type="text"
                  value={repositoryPath}
                />
                <button className="secondary-button" disabled={!canSubmitRepository} type="submit">
                  {adding ? 'Adding...' : 'OK'}
                </button>
                <button
                  className="secondary-button"
                  disabled={adding}
                  onClick={() => {
                    setRepositoryPath('');
                    setIsAddingRepository(false);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                {addError && <div className="repository-add-error">{addError}</div>}
              </form>
            )}
          </div>
          {editError && <div className="repository-edit-error">{editError}</div>}
        </section>
      </main>
    </div>
  );
}

function orderRepositories(
  repositories: ResolvedRepository[],
  pendingOrder: RepositoryId[] | null,
): ResolvedRepository[] {
  if (!pendingOrder) {
    return repositories;
  }

  const repositoriesById = new Map(repositories.map((repository) => [repository.id, repository]));
  const orderedRepositories = pendingOrder
    .map((id) => repositoriesById.get(id))
    .filter((repository): repository is ResolvedRepository => repository !== undefined);
  const orderedIds = new Set(orderedRepositories.map((repository) => repository.id));
  const newRepositories = repositories.filter((repository) => !orderedIds.has(repository.id));
  return [...orderedRepositories, ...newRepositories];
}

function moveRepository(
  orderedIds: RepositoryId[],
  sourceId: RepositoryId,
  targetId: RepositoryId,
  position: 'before' | 'after',
): RepositoryId[] {
  if (sourceId === targetId || !orderedIds.includes(sourceId) || !orderedIds.includes(targetId)) {
    return orderedIds;
  }

  const withoutSource = orderedIds.filter((id) => id !== sourceId);
  const targetIndex = withoutSource.indexOf(targetId);
  const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
  return [...withoutSource.slice(0, insertIndex), sourceId, ...withoutSource.slice(insertIndex)];
}
