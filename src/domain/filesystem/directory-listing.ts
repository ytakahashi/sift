export interface DirectoryEntry {
  name: string;
  /** Absolute path of the entry, preserving symbolic links. */
  path: string;
  /** A display hint based on the presence of `.git`, not repository validation. */
  isGitRepository: boolean;
}

export interface DirectoryListing {
  /** Normalized absolute path, preserving symbolic links. */
  path: string;
  /** The same `.git` display hint as entries, applied to the listed directory itself. */
  isGitRepository: boolean;
  /** Null at the filesystem root. */
  parentPath: string | null;
  /** Directories only, sorted case-insensitively. */
  entries: DirectoryEntry[];
  /** True when entries were cut at the server-side cap. */
  truncated: boolean;
}
