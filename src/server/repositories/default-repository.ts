export const DEFAULT_REPO_ID = 'default';

export interface ServerRepository {
  id: string;
  path: string;
}

export function createDefaultRepository(repoRoot: string): ServerRepository {
  return {
    id: DEFAULT_REPO_ID,
    path: repoRoot,
  };
}
