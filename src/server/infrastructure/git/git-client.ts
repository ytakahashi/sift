import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitClient {
  constructor(readonly repoRoot: string) {}

  async runGitCommand(args: string[]): Promise<string> {
    return this.execGit(args);
  }

  /**
   * Shared `execFile` + error-wrapping for both text (`runGitCommand`) and
   * binary (`getBlobContent`) output, so the two call sites don't duplicate
   * the "Git command failed" formatting.
   */
  private async execGit(args: string[]): Promise<string>;
  private async execGit(args: string[], options: { encoding: 'buffer' }): Promise<Buffer>;
  private async execGit(
    args: string[],
    options?: { encoding: 'buffer' },
  ): Promise<string | Buffer> {
    try {
      if (options?.encoding === 'buffer') {
        const { stdout } = await execFileAsync('git', args, {
          cwd: this.repoRoot,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          encoding: 'buffer',
        });
        return stdout;
      }

      const { stdout } = await execFileAsync('git', args, {
        cwd: this.repoRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return stdout;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Git command failed: git ${args.join(' ')}\n${msg}`, { cause: error });
    }
  }

  async getDiffOutput(staged: boolean): Promise<string> {
    const args = ['diff', '--no-ext-diff', '--color=never', '--full-index'];
    if (staged) {
      args.push('--cached');
    }
    return await this.runGitCommand(args);
  }

  async getUntrackedFiles(): Promise<string[]> {
    const args = ['ls-files', '--others', '--exclude-standard'];
    const output = await this.runGitCommand(args);
    return output.split('\n').filter(Boolean);
  }

  async getStatus(): Promise<string> {
    return await this.runGitCommand(['status', '--short', '--porcelain']);
  }

  async getIndexEntry(path: string): Promise<{ mode: string; blobId: string } | null> {
    const output = await this.runGitCommand([
      '--literal-pathspecs',
      'ls-files',
      '--stage',
      '-z',
      '--',
      path,
    ]);

    for (const record of output.split('\0')) {
      if (record === '') {
        continue;
      }

      const match = record.match(/^(\d{6}) ([0-9a-f]+) ([0-3])\t([\s\S]*)$/);
      if (match?.[3] === '0' && match[4] === path) {
        return { mode: match[1], blobId: match[2] };
      }
    }

    return null;
  }

  async getBlobSize(blobId: string): Promise<number> {
    const output = await this.runGitCommand(['cat-file', '-s', blobId]);
    const size = Number.parseInt(output.trim(), 10);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`git cat-file returned an invalid blob size: ${output.trim()}`);
    }
    return size;
  }

  async getBlobContent(blobId: string): Promise<Buffer> {
    return this.execGit(['cat-file', '-p', blobId], { encoding: 'buffer' });
  }

  async cleanPath(path: string): Promise<void> {
    await this.runGitCommand(['clean', '-f', '--', path]);
  }

  async restoreWorktree(paths: string[]): Promise<void> {
    // Omitting --source defaults to the index, which discards only unstaged changes
    // in the working tree while preserving any changes already added to the index.
    await this.runGitCommand(['restore', '--worktree', '--', ...paths]);
  }

  /**
   * Computes Git blob ids for worktree files in one subprocess
   * (`git hash-object --stdin-paths`), preserving input order.
   *
   * Throws when the process fails or the output count does not match the
   * input count: a partial output cannot be attributed to specific paths
   * safely, so callers must treat the whole batch as indeterminate.
   */
  async hashObjects(paths: string[]): Promise<string[]> {
    if (paths.length === 0) {
      return [];
    }

    return await new Promise<string[]>((resolvePromise, rejectPromise) => {
      const child = spawn('git', ['hash-object', '--stdin-paths'], { cwd: this.repoRoot });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error: Error) => {
        rejectPromise(
          new Error(`Git command failed: git hash-object --stdin-paths\n${error.message}`),
        );
      });
      child.on('close', (code: number | null) => {
        if (code !== 0) {
          rejectPromise(
            new Error(`Git command failed: git hash-object --stdin-paths\n${stderr.trim()}`),
          );
          return;
        }
        const blobIds = stdout.split('\n').filter(Boolean);
        if (blobIds.length !== paths.length) {
          rejectPromise(
            new Error(`git hash-object returned ${blobIds.length} ids for ${paths.length} paths`),
          );
          return;
        }
        resolvePromise(blobIds);
      });

      child.stdin.write(`${paths.join('\n')}\n`);
      child.stdin.end();
    });
  }
}
