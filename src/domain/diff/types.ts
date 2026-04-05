export type AppMode = 'repository' | 'stdin' | 'commit-range';

export type DiffContext = {
  id: string;
  mode: AppMode;
  repoRoot?: string;
  baseRef?: string;
  targetRef?: string;
};

export type FileBucket = 'working' | 'staged' | 'single';

export interface DiffFile {
  id: string; // Typically file path
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
