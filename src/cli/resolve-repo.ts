import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { statSync } from 'node:fs';

export function resolveRepoRoot(targetPath: string = process.cwd()): string {
  try {
    const absolutePath = resolve(targetPath);
    // Check if the target is a directory
    const stats = statSync(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Target path is not a directory: ${absolutePath}`);
    }

    // Try to find git rev-parse --show-toplevel
    const buffer = execSync('git rev-parse --show-toplevel', {
      cwd: absolutePath,
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const repoRoot = buffer.toString().trim();
    if (!repoRoot) {
      throw new Error('Not a git repository');
    }
    return repoRoot;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve repository at ${targetPath}: ${msg}`, { cause: error });
  }
}
