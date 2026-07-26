import type { RepositoryDiff } from '../../domain/diff/types';
import type { Note, NoteCreateTarget } from '../../domain/notes/types';
import type {
  RepositoryId,
  RepositoryList,
  ResolvedRepository,
} from '../../domain/repository/repository';

export class RepositoryFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'RepositoryFetchError';
  }
}

export class DiffFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'DiffFetchError';
  }
}

export class FileContentFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'FileContentFetchError';
  }
}

export class WorkspaceActionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'WorkspaceActionError';
  }
}

/**
 * Thrown by NotesGateway implementations on non-2xx responses. The message
 * comes from the server's `{ error }` body, so recovery guidance (e.g. the
 * 422 hints about file notes or buckets) can be shown to the user verbatim.
 */
export class NotesActionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'NotesActionError';
  }
}

export interface DiffReader {
  fetchDiff(repoId: RepositoryId): Promise<RepositoryDiff>;
}

export interface FileContent {
  blobId: string;
  lines: string[];
}

export interface FileContentReader {
  fetchFileContent(repoId: RepositoryId, path: string): Promise<FileContent>;
}

export interface RepositoryReader {
  fetchRepositories(): Promise<RepositoryList>;
  fetchRepository(repoId: RepositoryId): Promise<ResolvedRepository>;
}

export interface RepositoryWriter {
  addRepository(path: string): Promise<void>;
  removeRepository(repoId: RepositoryId): Promise<void>;
  reorderRepositories(orderedIds: RepositoryId[]): Promise<void>;
}

export interface WorkspaceActions {
  stageFile(repoId: RepositoryId, path: string): Promise<void>;
  unstageFile(repoId: RepositoryId, path: string): Promise<void>;
  stageAllWorkingFiles(repoId: RepositoryId): Promise<void>;
  unstageAllStagedFiles(repoId: RepositoryId): Promise<void>;
  discardWorkingFile(repoId: RepositoryId, path: string): Promise<void>;
  discardAllWorkingFiles(repoId: RepositoryId): Promise<void>;
  stageHunk(repoId: RepositoryId, path: string, hunkId: string): Promise<void>;
  unstageHunk(repoId: RepositoryId, path: string, hunkId: string): Promise<void>;
}

export interface NotesGateway {
  fetchNotes(repoId: RepositoryId): Promise<Note[]>;
  addNote(repoId: RepositoryId, target: NoteCreateTarget, body: string): Promise<Note>;
  updateNote(repoId: RepositoryId, noteId: string, body: string): Promise<Note>;
  deleteNote(repoId: RepositoryId, noteId: string): Promise<void>;
  clearNotes(repoId: RepositoryId): Promise<void>;
}

export interface RepositoryChangeSubscription {
  unsubscribe(): void;
}

/** Both events arrive over the single per-repository SSE connection. */
export interface RepositoryChangeHandlers {
  onDiffChange: () => void;
  onNotesChange: () => void;
}

export interface RepositoryChangeSource {
  subscribe(repoId: RepositoryId, handlers: RepositoryChangeHandlers): RepositoryChangeSubscription;
}
