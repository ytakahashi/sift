import type { DiffFile } from './types';

export interface DiffLineStats {
  additions: number;
  deletions: number;
}

export function computeDiffLineStats(file: DiffFile): DiffLineStats {
  const stats: DiffLineStats = { additions: 0, deletions: 0 };

  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') {
        stats.additions += 1;
      } else if (line.type === 'delete') {
        stats.deletions += 1;
      }
    }
  }

  return stats;
}

export function computeDiffFilesLineStats(files: DiffFile[]): DiffLineStats {
  const stats: DiffLineStats = { additions: 0, deletions: 0 };

  for (const file of files) {
    const fileStats = computeDiffLineStats(file);
    stats.additions += fileStats.additions;
    stats.deletions += fileStats.deletions;
  }

  return stats;
}
