import type {
  DiffReader,
  RepositoryReader,
  RepositoryChangeSource,
  WorkspaceActions,
} from '../application/ports';

export interface AppDependencies {
  diffReader: DiffReader;
  repositoryReader: RepositoryReader;
  workspaceActions: WorkspaceActions;
  repositoryChangeSource: RepositoryChangeSource;
}
