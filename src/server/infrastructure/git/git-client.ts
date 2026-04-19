import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitClient {
  constructor(readonly repoRoot: string) {}

  async runGitCommand(args: string[]): Promise<string> {
    try {
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
    const args = ['diff', '--no-ext-diff', '--color=never'];
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

  async cleanPath(path: string): Promise<void> {
    await this.runGitCommand(['clean', '-f', '--', path]);
  }

  async restoreWorktree(paths: string[]): Promise<void> {
    await this.runGitCommand(['restore', '--worktree', '--source=HEAD', '--', ...paths]);
  }
}
