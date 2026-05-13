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
    editError,
    refresh,
    addRepository,
    deleteRepositories,
    saving,
    clearEditError,
  } = useRepositories(dependencies.repositoryReader, dependencies.repositoryWriter);

  return (
    <RepositorySelection
      adding={adding}
      addError={addError}
      configMissingError={configMissingError}
      editError={editError}
      error={error}
      loading={loading}
      onAddRepository={addRepository}
      onDeleteRepositories={deleteRepositories}
      onRefresh={() => void refresh()}
      onSelectRepository={onSelectRepository}
      repositories={repositories}
      saving={saving}
      clearEditError={clearEditError}
    />
  );
}
