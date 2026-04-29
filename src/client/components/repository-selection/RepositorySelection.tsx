import { useState, type FormEvent, type ReactElement } from 'react';
import type {
  RepositoryId,
  RepositoryList,
  RepositoryListItem,
} from '../../../domain/repository/repository';

export interface RepositorySelectionProps {
  addError: string | null;
  adding: boolean;
  error: string | null;
  loading: boolean;
  onAddRepository: (path: string) => Promise<boolean>;
  onRefresh: () => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  repositories: RepositoryList | null;
}

function getConfigMessage(repositories: RepositoryList | null): string | null {
  if (!repositories) {
    return null;
  }

  if (repositories.config.status === 'missing') {
    return `Config missing: ${repositories.config.path}`;
  }

  if (repositories.config.status === 'invalid') {
    return repositories.config.error;
  }

  return null;
}

function RepositoryRow({
  repository,
  onSelectRepository,
}: {
  onSelectRepository: (repoId: RepositoryId) => void;
  repository: RepositoryListItem;
}): ReactElement {
  return (
    <li className={`repository-item ${repository.isValid ? '' : 'repository-item-invalid'}`}>
      <button
        className="repository-button"
        disabled={!repository.isValid}
        onClick={() => onSelectRepository(repository.id)}
        title={repository.path}
        type="button"
      >
        <span className="repository-name">{repository.name}</span>
        <span className="repository-path">{repository.path}</span>
        {!repository.isValid && repository.error && (
          <span className="repository-error">{repository.error}</span>
        )}
      </button>
    </li>
  );
}

export function RepositorySelection({
  addError,
  adding,
  error,
  loading,
  onAddRepository,
  onRefresh,
  onSelectRepository,
  repositories,
}: RepositorySelectionProps): ReactElement {
  const [isAddingRepository, setIsAddingRepository] = useState(false);
  const [repositoryPath, setRepositoryPath] = useState('');
  const configMessage = getConfigMessage(repositories);
  const items = repositories?.repositories ?? [];
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
          <img src="/favicon.svg" alt="Sift Logo" style={{ width: '22px', height: '22px' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Sift</h1>
        </div>
        <div className="app-header-actions">
          {/* Fetch errors mean the latest repository list is unknown, so show
          them ahead of config-state messages derived from older or partial data. */}
          {(error || configMessage) && (
            <span className="repository-selection-status">{error || configMessage}</span>
          )}
          <button className="secondary-button" onClick={onRefresh} type="button">
            Refresh
          </button>
        </div>
      </header>
      <main className="repository-selection-main">
        <section className="repository-selection-content">
          <div className="repository-selection-heading">
            <h2>Repositories</h2>
            <span>{loading ? 'Loading...' : `${items.length} configured`}</span>
          </div>
          {items.length > 0 ? (
            <ul className="repository-list">
              {items.map((repository) => (
                <RepositoryRow
                  key={repository.id}
                  onSelectRepository={onSelectRepository}
                  repository={repository}
                />
              ))}
            </ul>
          ) : (
            <div className="repository-empty">
              {loading ? 'Loading repositories...' : 'No repositories available.'}
            </div>
          )}
          <div className="repository-add">
            {isAddingRepository ? (
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
            ) : (
              <button
                className="secondary-button"
                disabled={loading}
                onClick={() => setIsAddingRepository(true)}
                type="button"
              >
                Add Repository
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
