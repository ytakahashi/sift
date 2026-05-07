import type { ReactElement } from 'react';
import type {
  RepositoryId,
  RepositoryList,
  ResolvedRepository,
} from '../../../domain/repository/repository';

export interface RepositorySidebarProps {
  configMissingError: string | null;
  currentRepositoryId: RepositoryId;
  error: string | null;
  loading: boolean;
  onSelectRepository: (repoId: RepositoryId) => void;
  repositories: RepositoryList | null;
}

function RepositorySidebarRow({
  currentRepositoryId,
  onSelectRepository,
  repository,
}: {
  currentRepositoryId: RepositoryId;
  onSelectRepository: (repoId: RepositoryId) => void;
  repository: ResolvedRepository;
}): ReactElement {
  const isCurrent = repository.id === currentRepositoryId;

  return (
    <li className="repository-sidebar-item">
      <button
        aria-current={isCurrent ? 'page' : undefined}
        className={`repository-sidebar-row${isCurrent ? ' repository-sidebar-row-current' : ''}`}
        onClick={() => {
          if (isCurrent) {
            return;
          }

          onSelectRepository(repository.id);
        }}
        title={repository.path}
        type="button"
      >
        <span className="repository-sidebar-name">{repository.name}</span>
        <span className="repository-sidebar-path">{repository.path}</span>
      </button>
    </li>
  );
}

export function RepositorySidebar({
  configMissingError,
  currentRepositoryId,
  error,
  loading,
  onSelectRepository,
  repositories,
}: RepositorySidebarProps): ReactElement {
  const items = repositories?.repositories ?? [];
  const statusMessage = error ?? configMissingError;

  return (
    <aside aria-label="Repository list" className="repository-sidebar">
      <div className="repository-sidebar-header">Repositories</div>
      {statusMessage ? <div className="repository-sidebar-error">{statusMessage}</div> : null}
      {loading && !statusMessage && items.length === 0 ? (
        <div className="repository-sidebar-empty">Loading repositories...</div>
      ) : null}
      {!loading && !statusMessage && items.length === 0 ? (
        <div className="repository-sidebar-empty">No repositories available.</div>
      ) : null}
      {items.length > 0 ? (
        <ul className="repository-sidebar-list">
          {items.map((repository) => (
            <RepositorySidebarRow
              key={repository.id}
              currentRepositoryId={currentRepositoryId}
              onSelectRepository={onSelectRepository}
              repository={repository}
            />
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
