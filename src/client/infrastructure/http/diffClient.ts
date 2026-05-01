import type { RepositoryDiff } from '../../../domain/diff/types';
import type { RepositoryId } from '../../../domain/repository/repository';
import { DiffFetchError, type DiffReader } from '../../application/ports';
import { readErrorMessage } from './errorResponse';

export const httpDiffReader: DiffReader = {
  async fetchDiff(repoId: RepositoryId): Promise<RepositoryDiff> {
    const res = await fetch(`/api/repositories/${encodeURIComponent(repoId)}/diff`);
    if (!res.ok) {
      throw new DiffFetchError(
        await readErrorMessage(res, `Failed to fetch diff: ${res.statusText}`),
        res.status,
      );
    }
    return (await res.json()) as RepositoryDiff;
  },
};
