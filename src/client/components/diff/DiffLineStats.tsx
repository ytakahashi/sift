import type { ReactElement } from 'react';
import {
  computeDiffFilesLineStats,
  computeDiffLineStats,
  type DiffLineStats as DiffLineStatsValue,
} from '../../../domain/diff/diff-line-stats';
import type { DiffFile } from '../../../domain/diff/types';

interface DiffLineStatsProps {
  file: DiffFile;
}

interface DiffFilesLineStatsProps {
  files: DiffFile[];
}

interface DiffLineStatsTextProps {
  stats: DiffLineStatsValue;
}

function formatLineCount(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function DiffLineStatsText({ stats }: DiffLineStatsTextProps): ReactElement | null {
  const { additions, deletions } = stats;

  if (additions === 0 && deletions === 0) {
    return null;
  }

  return (
    <span
      aria-label={`${formatLineCount(additions, 'addition')}, ${formatLineCount(
        deletions,
        'deletion',
      )}`}
      className="diff-line-stats"
    >
      {additions > 0 && <span className="diff-line-stats-add">+{additions}</span>}
      {deletions > 0 && <span className="diff-line-stats-delete">-{deletions}</span>}
    </span>
  );
}

export function DiffLineStats({ file }: DiffLineStatsProps): ReactElement | null {
  return <DiffLineStatsText stats={computeDiffLineStats(file)} />;
}

export function DiffFilesLineStats({ files }: DiffFilesLineStatsProps): ReactElement | null {
  return <DiffLineStatsText stats={computeDiffFilesLineStats(files)} />;
}
