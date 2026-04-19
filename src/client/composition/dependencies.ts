import type {
  DiffReader,
  RepositoryChangeSource,
  SessionReader,
  WorkspaceActions,
} from '../application/ports';

export interface AppDependencies {
  diffReader: DiffReader;
  sessionReader: SessionReader;
  workspaceActions: WorkspaceActions;
  repositoryChangeSource: RepositoryChangeSource;
}
