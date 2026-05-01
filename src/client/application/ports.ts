import type { RepositoryDiff } from '../../domain/diff/types';
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

export interface DiffReader {
  fetchDiff(repoId: RepositoryId): Promise<RepositoryDiff>;
}

export interface RepositoryReader {
  fetchRepositories(): Promise<RepositoryList>;
  fetchRepository(repoId: RepositoryId): Promise<ResolvedRepository>;
}

export interface RepositoryWriter {
  addRepository(path: string): Promise<void>;
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

export interface RepositoryChangeSubscription {
  unsubscribe(): void;
}

export interface RepositoryChangeSource {
  subscribe(repoId: RepositoryId, onChange: () => void): RepositoryChangeSubscription;
}
