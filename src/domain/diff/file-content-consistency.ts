import type { DiffHunk } from './types';

export function isFileLinesConsistentWithHunks(hunks: DiffHunk[], fileLines: string[]): boolean {
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.newLineNumber === undefined) {
        continue;
      }
      if (fileLines[line.newLineNumber - 1] !== line.content) {
        return false;
      }
    }
  }

  return true;
}
