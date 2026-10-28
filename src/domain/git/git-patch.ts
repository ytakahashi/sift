import type { DiffFile, DiffHunk } from '../diff/types';
import { encodeGitPath } from './git-path';

export function createPatchForHunk(file: DiffFile, hunk: DiffHunk): string {
  const aPath = encodeGitPath(`a/${file.oldPath || file.path}`);
  const bPath = encodeGitPath(`b/${file.path}`);

  let patch = `diff --git ${aPath} ${bPath}\n`;
  patch += `--- ${aPath}\n`;
  patch += `+++ ${bPath}\n`;
  patch += `${hunk.header}\n`;

  for (const line of hunk.lines) {
    if (line.type === 'add') {
      patch += `+${line.content}\n`;
    } else if (line.type === 'delete') {
      patch += `-${line.content}\n`;
    } else {
      patch += ` ${line.content}\n`;
    }
    if (line.noNewlineAtEnd) {
      patch += '\\ No newline at end of file\n';
    }
  }

  return patch;
}
