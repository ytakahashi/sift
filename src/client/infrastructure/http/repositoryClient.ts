import type {
  RepositoryId,
  RepositoryList,
  RepositoryListItem,
} from '../../../domain/repository/repository';
import type { RepositoryReader } from '../../application/ports';

export const httpRepositoryReader: RepositoryReader = {
  async fetchRepositories(): Promise<RepositoryList> {
    const res = await fetch('/api/repositories');
    if (!res.ok) {
      throw new Error(`Failed to fetch repositories: ${res.statusText}`);
    }

    return (await res.json()) as RepositoryList;
  },
  async fetchRepository(repoId: RepositoryId): Promise<RepositoryListItem> {
    const res = await fetch(`/api/repositories/${encodeURIComponent(repoId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch repository: ${res.statusText}`);
    }

    return (await res.json()) as RepositoryListItem;
  },
};
