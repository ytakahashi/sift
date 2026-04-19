import type { DiffData, DiffReader } from '../../application/ports';

export const httpDiffReader: DiffReader = {
  async fetchDiff(): Promise<DiffData> {
    const res = await fetch('/api/diff');
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
