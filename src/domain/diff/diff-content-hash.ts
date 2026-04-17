import type { DiffFile } from './types';

export function computeDiffContentHash(workingFiles: DiffFile[], stagedFiles: DiffFile[]): string {
  const byPath = new Map<
    string,
    {
      kinds: Set<string>;
      oldPaths: Set<string>;
      statuses: Set<string>;
      lines: string[];
    }
  >();

  for (const file of [...workingFiles, ...stagedFiles]) {
    const lines = file.hunks
      .flatMap((h) => h.lines)
      .filter((l) => l.type !== 'context') // Ignore context lines as their count may fluctuate upon hunk merging
      .map((l) => l.type[0] + l.content);

    const existing = byPath.get(file.path) ?? {
      kinds: new Set<string>(),
      oldPaths: new Set<string>(),
      statuses: new Set<string>(),
      lines: [],
    };
    existing.kinds.add(file.kind);
    existing.statuses.add(file.status);
    if (file.oldPath) {
      existing.oldPaths.add(file.oldPath);
    }
    existing.lines.push(...lines);
    byPath.set(file.path, existing);
  }

  return [...byPath.entries()]
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .map(([path, metadata]) => {
      // Sort lines to ensure stable hash regardless of hunk movement between working and staged
      const sortedLines = [...metadata.lines].sort();
      return [
        path,
        [...metadata.oldPaths].sort().join('\0'),
        [...metadata.statuses].sort().join('\0'),
        [...metadata.kinds].sort().join('\0'),
        sortedLines.join('\0'),
      ].join('\0');
    })
    .join('\n');
}
