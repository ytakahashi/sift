import type { DiffFile } from './types';

export function computeDiffContentHash(workingFiles: DiffFile[], stagedFiles: DiffFile[]): string {
  // Map of file path to extracted line content strings
  const byPath = new Map<string, string[]>();

  for (const file of [...workingFiles, ...stagedFiles]) {
    const lines = file.hunks
      .flatMap((h) => h.lines)
      .filter((l) => l.type !== 'context') // Ignore context lines as their count may fluctuate upon hunk merging
      .map((l) => l.type[0] + l.content);

    const existing = byPath.get(file.path) ?? [];
    byPath.set(file.path, existing.concat(lines));
  }

  return [...byPath.entries()]
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .map(([path, lines]) => {
      // Sort lines to ensure stable hash regardless of hunk movement between working and staged
      const sortedLines = [...lines].sort();
      return `${path}\0${sortedLines.join('')}`;
    })
    .join('\n');
}
