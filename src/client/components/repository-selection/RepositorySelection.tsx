import type { ReactElement } from 'react';
import type {
  RepositoryId,
  RepositoryList,
  RepositoryListItem,
} from '../../../domain/repository/repository';

export interface RepositorySelectionProps {
  error: string | null;
  loading: boolean;
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
  error,
  loading,
  onRefresh,
  onSelectRepository,
  repositories,
}: RepositorySelectionProps): ReactElement {
  const configMessage = getConfigMessage(repositories);
  const items = repositories?.repositories ?? [];

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
        </section>
      </main>
    </div>
  );
}
