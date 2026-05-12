import { useState, type FormEvent, type ReactElement } from 'react';
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
  deleteError: string | null;
  deletingRepositoryId: RepositoryId | null;
  error: string | null;
  loading: boolean;
  onAddRepository: (path: string) => Promise<boolean>;
  onDeleteRepository: (repoId: RepositoryId) => Promise<boolean>;
  onRefresh: () => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  repositories: RepositoryList | null;
  clearDeleteError: () => void;
}

function RepositoryRow({
  deleting,
  isEditing,
  onDeleteRepository,
  onSelectRepository,
  repository,
}: {
  deleting: boolean;
  isEditing: boolean;
  onDeleteRepository: (repoId: RepositoryId) => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  repository: ResolvedRepository;
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
    <li className="repository-item repository-editing-item">
      {content}
      <button
        aria-label={`Remove ${repository.name}`}
        className="repository-delete-button"
        disabled={deleting}
        onClick={() => void onDeleteRepository(repository.id)}
        title={`Remove ${repository.path}`}
        type="button"
      >
        x
      </button>
    </li>
  );
}

function InvalidRepositoryRow({
  deleting,
  isEditing,
  onDeleteRepository,
  repository,
}: {
  deleting: boolean;
  isEditing: boolean;
  onDeleteRepository: (repoId: RepositoryId) => void;
  repository: InvalidRepository;
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
    <li className="repository-item repository-item-invalid repository-editing-item">
      {content}
      <button
        aria-label={`Remove ${repository.name}`}
        className="repository-delete-button"
        disabled={deleting}
        onClick={() => void onDeleteRepository(repository.id)}
        title={`Remove ${repository.path}`}
        type="button"
      >
        x
      </button>
    </li>
  );
}

export function RepositorySelection({
  addError,
  adding,
  configMissingError,
  deleteError,
  deletingRepositoryId,
  error,
  loading,
  onAddRepository,
  onDeleteRepository,
  onRefresh,
  onSelectRepository,
  repositories,
  clearDeleteError,
}: RepositorySelectionProps): ReactElement {
  const [isAddingRepository, setIsAddingRepository] = useState(false);
  const [isEditingRepositoryList, setIsEditingRepositoryList] = useState(false);
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
          <button
            className="secondary-button"
            disabled={deletingRepositoryId !== null}
            onClick={onRefresh}
            type="button"
          >
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
                  deleting={deletingRepositoryId !== null}
                  isEditing={isEditingRepositoryList}
                  key={repository.id}
                  onDeleteRepository={onDeleteRepository}
                  onSelectRepository={onSelectRepository}
                  repository={repository}
                />
              ))}
              {invalidItems.map((repository) => (
                <InvalidRepositoryRow
                  deleting={deletingRepositoryId !== null}
                  isEditing={isEditingRepositoryList}
                  key={repository.id}
                  onDeleteRepository={onDeleteRepository}
                  repository={repository}
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
                  disabled={loading || isEditingRepositoryList || deletingRepositoryId !== null}
                  onClick={() => setIsAddingRepository(true)}
                  type="button"
                >
                  Add Repository
                </button>
                {(itemCount > 0 || isEditingRepositoryList) && (
                  <button
                    className="secondary-button"
                    disabled={loading || deletingRepositoryId !== null}
                    onClick={() => {
                      if (isEditingRepositoryList) {
                        clearDeleteError();
                      }
                      setIsEditingRepositoryList(!isEditingRepositoryList);
                    }}
                    type="button"
                  >
                    {isEditingRepositoryList ? 'Done' : 'Edit Repository List'}
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
          {deleteError && <div className="repository-delete-error">{deleteError}</div>}
        </section>
      </main>
    </div>
  );
}
