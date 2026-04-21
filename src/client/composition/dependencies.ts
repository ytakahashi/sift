import type {
  DiffReader,
  RepositoryReader,
  RepositoryChangeSource,
  SessionReader,
  WorkspaceActions,
} from '../application/ports';

export interface AppDependencies {
  diffReader: DiffReader;
  repositoryReader: RepositoryReader;
  sessionReader: SessionReader;
  workspaceActions: WorkspaceActions;
  repositoryChangeSource: RepositoryChangeSource;
}
