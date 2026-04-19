import type { DiffFile, DiffHunk } from '../diff/types';

export function createPatchForHunk(file: DiffFile, hunk: DiffHunk): string {
  const aPath = file.oldPath || file.path;
  const bPath = file.path;

  let patch = `diff --git a/${aPath} b/${bPath}\n`;
  patch += `--- a/${aPath}\n`;
  patch += `+++ b/${bPath}\n`;
  patch += `${hunk.header}\n`;

  for (const line of hunk.lines) {
    if (line.type === 'add') {
      patch += `+${line.content}\n`;
    } else if (line.type === 'delete') {
      patch += `-${line.content}\n`;
    } else {
      patch += ` ${line.content}\n`;
    }
  }

  return patch;
}
