import { DEFAULT_REPO_ID } from '../../domain/repository/repository';
import type { ServerRepository } from './server-repository';

export { DEFAULT_REPO_ID };

export function createDefaultRepository(repoRoot: string): ServerRepository {
  return {
    id: DEFAULT_REPO_ID,
    path: repoRoot,
  };
}
