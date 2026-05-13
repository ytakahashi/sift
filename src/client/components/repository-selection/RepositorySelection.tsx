import { useState, type FormEvent, type ReactElement } from 'react';
import { X } from 'lucide-react';
import type {
  InvalidRepository,
  RepositoryId,
  RepositoryList,
  ResolvedRepository,
} from '../../../domain/repository/repository';

export interface RepositorySelectionProps {
  addError: string | null;
  adding: boolean;
  configMissingError: string | null;
  editError: string | null;
  error: string | null;
  loading: boolean;
  onAddRepository: (path: string) => Promise<boolean>;
  onDeleteRepositories: (repoIds: RepositoryId[]) => Promise<boolean>;
  onRefresh: () => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  repositories: RepositoryList | null;
  saving: boolean;
  clearEditError: () => void;
}

function RepositoryRow({
  isEditing,
  onToggleDelete,
  onSelectRepository,
  pendingDelete,
  repository,
  saving,
}: {
  isEditing: boolean;
  onToggleDelete: (repoId: RepositoryId) => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  pendingDelete: boolean;
  repository: ResolvedRepository;
  saving: boolean;
}): ReactElement {
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

  if (!isEditing) {
    return <li className="repository-item">{content}</li>;
  }

  return (
    <li
      className={`repository-item repository-editing-item${
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
  onDeleteRepositories,
  onRefresh,
  onSelectRepository,
  repositories,
  saving,
  clearEditError,
}: RepositorySelectionProps): ReactElement {
  const [isAddingRepository, setIsAddingRepository] = useState(false);
  const [isEditingRepositoryList, setIsEditingRepositoryList] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<RepositoryId>>(new Set());
  const [repositoryPath, setRepositoryPath] = useState('');
  const items = repositories?.repositories ?? [];
  const invalidItems = repositories?.invalidRepositories ?? [];
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
      clearEditError();
      setIsEditingRepositoryList(true);
      return;
    }

    if (pendingDeleteIds.size === 0) {
      clearEditError();
      setIsEditingRepositoryList(false);
      return;
    }

    const deleteIds = [...pendingDeleteIds];
    const deleted = await onDeleteRepositories(deleteIds);
    // Drop the pending marks regardless of outcome: the hook has already
    // refreshed the list against the latest config, so successfully removed
    // entries are gone and any remaining ones should appear unmarked. Keeping
    // the old pending state would show stale strike-through on rows that no
    // longer exist or that the user may have changed their mind about.
    setPendingDeleteIds(new Set());

    if (!deleted) {
      return;
    }

    setIsEditingRepositoryList(false);
  };

  const handleCancelEdit = (): void => {
    setPendingDeleteIds(new Set());
    clearEditError();
    setIsEditingRepositoryList(false);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-brand">
          <div className="app-brand-home">
            <img className="app-brand-logo" src="/favicon.svg" alt="" />
            <h1 className="app-brand-title">Sift</h1>
          </div>
        </div>
        <div className="app-header-actions">
          {/* Fetch errors mean the latest repository list is unknown, so show
          them ahead of config-state messages derived from older or partial data. */}
          {(error || configMissingError) && (
            <span className="repository-selection-status">{error || configMissingError}</span>
          )}
          <button className="secondary-button" disabled={saving} onClick={onRefresh} type="button">
            Refresh
          </button>
        </div>
      </header>
      <main className="repository-selection-main">
        <section className="repository-selection-content">
          <div className="repository-selection-heading">
            <h2>Repositories</h2>
            <span>{loading ? 'Loading...' : `${itemCount} configured`}</span>
          </div>
          {itemCount > 0 ? (
            <ul className="repository-list">
              {items.map((repository) => (
                <RepositoryRow
                  isEditing={isEditingRepositoryList}
                  key={repository.id}
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
