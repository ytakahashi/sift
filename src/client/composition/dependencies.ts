import type {
  DiffReader,
  RepositoryReader,
  RepositoryWriter,
  RepositoryChangeSource,
  WorkspaceActions,
} from '../application/ports';

export interface AppDependencies {
  diffReader: DiffReader;
  repositoryReader: RepositoryReader;
  repositoryWriter: RepositoryWriter;
  workspaceActions: WorkspaceActions;
  repositoryChangeSource: RepositoryChangeSource;
}
