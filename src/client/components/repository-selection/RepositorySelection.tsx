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
  error: string | null;
  loading: boolean;
  onAddRepository: (path: string) => Promise<boolean>;
  onRefresh: () => void;
  onSelectRepository: (repoId: RepositoryId) => void;
  repositories: RepositoryList | null;
}

function RepositoryRow({
  repository,
  onSelectRepository,
}: {
  onSelectRepository: (repoId: RepositoryId) => void;
  repository: ResolvedRepository;
}): ReactElement {
  return (
    <li className="repository-item">
      <button
        className="repository-button"
        onClick={() => onSelectRepository(repository.id)}
        title={repository.path}
        type="button"
      >
        <span className="repository-name">{repository.name}</span>
        <span className="repository-path">{repository.path}</span>
      </button>
    </li>
  );
}

function InvalidRepositoryRow({ repository }: { repository: InvalidRepository }): ReactElement {
  return (
    <li className="repository-item repository-item-invalid">
      <div className="repository-item-content" title={repository.path}>
        <span className="repository-name">{repository.name}</span>
        <span className="repository-path">{repository.path}</span>
        <span className="repository-error">{repository.reason}</span>
      </div>
    </li>
  );
}

export function RepositorySelection({
  addError,
  adding,
  configMissingError,
  error,
  loading,
  onAddRepository,
  onRefresh,
  onSelectRepository,
  repositories,
}: RepositorySelectionProps): ReactElement {
  const [isAddingRepository, setIsAddingRepository] = useState(false);
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
          <img src="/favicon.svg" alt="Sift Logo" style={{ width: '22px', height: '22px' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Sift</h1>
        </div>
        <div className="app-header-actions">
          {/* Fetch errors mean the latest repository list is unknown, so show
          them ahead of config-state messages derived from older or partial data. */}
          {(error || configMissingError) && (
            <span className="repository-selection-status">{error || configMissingError}</span>
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
            <span>{loading ? 'Loading...' : `${itemCount} configured`}</span>
          </div>
          {itemCount > 0 ? (
            <ul className="repository-list">
              {items.map((repository) => (
                <RepositoryRow
                  key={repository.id}
                  onSelectRepository={onSelectRepository}
                  repository={repository}
                />
              ))}
              {invalidItems.map((repository) => (
                <InvalidRepositoryRow key={repository.id} repository={repository} />
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
