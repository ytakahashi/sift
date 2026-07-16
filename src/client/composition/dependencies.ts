import type {
  DiffReader,
  NotesGateway,
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
  notesGateway: NotesGateway;
  repositoryChangeSource: RepositoryChangeSource;
}
