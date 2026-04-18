import type { DiffFile } from '../../domain/diff/types';
import type { SessionInfo } from '../../domain/session/types';

export interface DiffData {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
}

export interface DiffReader {
  fetchDiff(): Promise<DiffData>;
}

export interface SessionReader {
  fetchSession(): Promise<SessionInfo>;
}

export interface WorkspaceActions {
  stageFile(path: string): Promise<void>;
  unstageFile(path: string): Promise<void>;
  discardWorkingFile(path: string): Promise<void>;
  stageHunk(path: string, hunkId: string): Promise<void>;
  unstageHunk(path: string, hunkId: string): Promise<void>;
}
