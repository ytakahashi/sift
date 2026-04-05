import { GitClient } from './git-client';
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

export async function applyPatch(
  gitClient: GitClient,
  patchContent: string,
  reverse: boolean,
): Promise<void> {
  // Using child_process.spawn or execFile with stdin
  // To avoid writing temp file, we can pass it via stdin to `git apply --cached`
  const { spawn } = await import('node:child_process');

  return new Promise((resolve, reject) => {
    const args = ['apply', '--cached', '--unidiff-zero'];
    if (reverse) {
      args.push('-R');
    }
    args.push('-');

    const child = spawn('git', args, { cwd: gitClient['repoRoot'] });

    let stderr = '';

    child.stderr.on('data', (data: Buffer | string) => {
      stderr += data.toString();
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git apply failed: ${stderr}`));
      }
    });

    child.stdin.write(patchContent);
    child.stdin.end();
  });
}
