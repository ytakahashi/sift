import type { DiffFile } from '../../domain/diff/types';
import type { RepositoryId, RepositoryList } from '../../domain/repository/repository';
import type { SessionInfo } from '../../domain/session/types';

export interface DiffData {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
}

export interface DiffReader {
  fetchDiff(repoId: RepositoryId): Promise<DiffData>;
}

export interface SessionReader {
  fetchSession(): Promise<SessionInfo>;
}

export interface RepositoryReader {
  fetchRepositories(): Promise<RepositoryList>;
}

export interface WorkspaceActions {
  stageFile(repoId: RepositoryId, path: string): Promise<void>;
  unstageFile(repoId: RepositoryId, path: string): Promise<void>;
  discardWorkingFile(repoId: RepositoryId, path: string): Promise<void>;
  stageHunk(repoId: RepositoryId, path: string, hunkId: string): Promise<void>;
  unstageHunk(repoId: RepositoryId, path: string, hunkId: string): Promise<void>;
}

export interface RepositoryChangeSubscription {
  unsubscribe(): void;
}

export interface RepositoryChangeSource {
  subscribe(repoId: RepositoryId, onChange: () => void): RepositoryChangeSubscription;
}
