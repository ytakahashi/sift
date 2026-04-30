import type {
  RepositoryId,
  RepositoryList,
  RepositoryListItem,
} from '../../../domain/repository/repository';
import {
  RepositoryFetchError,
  type RepositoryReader,
  type RepositoryWriter,
} from '../../application/ports';

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as unknown;
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      return body.error;
    }
  } catch (_error: unknown) {
    return fallback;
  }

  return fallback;
}

export const httpRepositoryReader: RepositoryReader = {
  async fetchRepositories(): Promise<RepositoryList> {
    const res = await fetch('/api/repositories');
    if (!res.ok) {
      throw new RepositoryFetchError(
        await readErrorMessage(res, `Failed to fetch repositories: ${res.statusText}`),
        res.status,
      );
    }

    return (await res.json()) as RepositoryList;
  },
  async fetchRepository(repoId: RepositoryId): Promise<RepositoryListItem> {
    const res = await fetch(`/api/repositories/${encodeURIComponent(repoId)}`);
    if (!res.ok) {
      throw new RepositoryFetchError(
        await readErrorMessage(res, `Failed to fetch repository: ${res.statusText}`),
        res.status,
      );
    }

    return (await res.json()) as RepositoryListItem;
  },
};

export const httpRepositoryWriter: RepositoryWriter = {
  async addRepository(repositoryPath: string): Promise<void> {
    const res = await fetch('/api/repositories', {
      body: JSON.stringify({ path: repositoryPath }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    if (!res.ok) {
      throw new Error(await readErrorMessage(res, `Failed to add repository: ${res.statusText}`));
    }
  },
};
