export type RepositoryIndexEntry = {
  mode: string;
  blobId: string;
};

/** Git mode 160000 stores a commit object for a submodule instead of file content. */
export function isSubmoduleIndexEntry(entry: Pick<RepositoryIndexEntry, 'mode'>): boolean {
  return entry.mode === '160000';
}

/** Provides stage-zero index entries keyed by exact repository-relative path. */
export interface RepositoryIndexProvider {
  getIndexEntries(paths: readonly string[]): Promise<ReadonlyMap<string, RepositoryIndexEntry>>;
}
