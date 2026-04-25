export interface WorkspaceActionService {
  stageFile(file: string): Promise<void>;
  unstageFile(file: string): Promise<void>;
  stageHunk(filePath: string, hunkId: string): Promise<void>;
  unstageHunk(filePath: string, hunkId: string): Promise<void>;
  discardWorkingFile(filePath: string): Promise<void>;
}
