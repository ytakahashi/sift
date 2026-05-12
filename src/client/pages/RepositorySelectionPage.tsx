import type { ReactElement } from 'react';
import type { RepositoryId } from '../../domain/repository/repository';
import { RepositorySelection } from '../components/repository-selection/RepositorySelection';
import { useRepositories } from '../hooks/repositories/useRepositories';
import type { AppDependencies } from '../composition/dependencies';

export interface RepositorySelectionPageProps {
  dependencies: AppDependencies;
  onSelectRepository: (repoId: RepositoryId) => void;
}

export function RepositorySelectionPage({
  dependencies,
  onSelectRepository,
}: RepositorySelectionPageProps): ReactElement {
  const {
    repositories,
    loading,
    adding,
    configMissingError,
    error,
    addError,
    deleteError,
    deletingRepositoryId,
    refresh,
    addRepository,
    deleteRepository,
  } = useRepositories(dependencies.repositoryReader, dependencies.repositoryWriter);

  return (
    <RepositorySelection
      adding={adding}
      addError={addError}
      configMissingError={configMissingError}
      deleteError={deleteError}
      deletingRepositoryId={deletingRepositoryId}
      error={error}
      loading={loading}
      onAddRepository={addRepository}
      onDeleteRepository={deleteRepository}
      onRefresh={() => void refresh()}
      onSelectRepository={onSelectRepository}
      repositories={repositories}
    />
  );
}
