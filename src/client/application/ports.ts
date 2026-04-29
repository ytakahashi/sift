import type { DiffFile } from '../../domain/diff/types';
import type {
  RepositoryId,
  RepositoryList,
  RepositoryListItem,
} from '../../domain/repository/repository';

export interface DiffData {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
}

export interface DiffReader {
  fetchDiff(repoId: RepositoryId): Promise<DiffData>;
}

export interface RepositoryReader {
  fetchRepositories(): Promise<RepositoryList>;
  fetchRepository(repoId: RepositoryId): Promise<RepositoryListItem>;
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
