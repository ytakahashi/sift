export type RepositoryIndexEntry = {
  mode: string;
  blobId: string;
};

/** Git mode 160000 stores a commit object for a submodule instead of file content. */
export function isSubmoduleIndexEntry(entry: Pick<RepositoryIndexEntry, 'mode'>): boolean {
  return entry.mode === '160000';
}

/** Provides the stage-zero index entry for one repository-relative path. */
export interface RepositoryIndexProvider {
  getIndexEntry(path: string): Promise<RepositoryIndexEntry | null>;
}
