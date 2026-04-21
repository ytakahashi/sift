import type { RepositoryId } from '../../../domain/repository/repository';
import type { DiffData, DiffReader } from '../../application/ports';

export const httpDiffReader: DiffReader = {
  async fetchDiff(repoId: RepositoryId): Promise<DiffData> {
    const res = await fetch(`/api/repositories/${encodeURIComponent(repoId)}/diff`);
    if (!res.ok) {
      throw new Error(`Failed to fetch diff: ${res.statusText}`);
    }
    const data = await res.json();
    return {
      workingFiles: data.workingFiles ?? [],
      stagedFiles: data.stagedFiles ?? [],
    };
  },
};
