import type { HeadRef } from '../git/head-ref';

export type FileBucket = 'working' | 'staged' | 'single';

/**
 * A best-effort repository read assembled from several Git invocations.
 *
 * Repository state may change while the response is being assembled, so its
 * parts are not guaranteed to describe the exact same instant.
 */
export interface RepositoryDiff {
  metadata: {
    repoRoot: string;
    revision: 'HEAD';
    /** HEAD observed during this diff read, for display purposes. */
    head: HeadRef;
  };
  stagedFiles: DiffFile[];
  workingFiles: DiffFile[];
}

export interface DiffFile {
  id: string; // Typically file path, consider creating a "FileId" type
  bucket: FileBucket;
  path: string;
  /** Old-side ID from the index header; added files carry Git's all-zero sentinel. */
  oldBlobId?: string;
  /** New-side ID from the index header; deleted files carry Git's all-zero sentinel. */
  newBlobId?: string;
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
