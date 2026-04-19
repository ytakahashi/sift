import { spawn } from 'node:child_process';
import type { GitClient } from './git-client';

export async function applyPatch(
  gitClient: GitClient,
  patchContent: string,
  reverse: boolean,
): Promise<void> {
  // Pass the generated patch via stdin to avoid writing temporary files.
  return new Promise((resolve, reject) => {
    const args = ['apply', '--cached', '--unidiff-zero'];
    if (reverse) {
      args.push('-R');
    }
    args.push('-');

    const child = spawn('git', args, { cwd: gitClient.repoRoot });

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
