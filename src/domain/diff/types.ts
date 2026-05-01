export type FileBucket = 'working' | 'staged' | 'single';

export interface RepositoryDiff {
  metadata: {
    repoRoot: string;
    revision: 'HEAD';
  };
  stagedFiles: DiffFile[];
  workingFiles: DiffFile[];
}

export interface DiffFile {
  id: string; // Typically file path, consider creating a "FileId" type
  bucket: FileBucket;
  path: string;
  oldPath?: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'binary' | 'submodule' | 'untracked';
  kind: 'text' | 'image' | 'binary' | 'submodule';
  displayPath: string;
  hunks: DiffHunk[];
}

export type DiffHunk = {
  id: string;
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
};

export type DiffLineType = 'context' | 'add' | 'delete';

export type DiffLine = {
  id: string;
  type: DiffLineType;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
};
