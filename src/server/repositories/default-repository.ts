import type { ServerRepository } from './server-repository';

export const DEFAULT_REPO_ID = 'default';

export function createDefaultRepository(repoRoot: string): ServerRepository {
  return {
    id: DEFAULT_REPO_ID,
    path: repoRoot,
  };
}
