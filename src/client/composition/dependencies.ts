import type {
  BlobContentReader,
  DiffReader,
  FileContentReader,
  NotesGateway,
  RepositoryReader,
  RepositoryWriter,
  RepositoryChangeSource,
  WorkspaceActions,
} from '../application/ports';

export interface AppDependencies {
  blobContentReader: BlobContentReader;
  diffReader: DiffReader;
  fileContentReader: FileContentReader;
  repositoryReader: RepositoryReader;
  repositoryWriter: RepositoryWriter;
  workspaceActions: WorkspaceActions;
  notesGateway: NotesGateway;
  repositoryChangeSource: RepositoryChangeSource;
}
