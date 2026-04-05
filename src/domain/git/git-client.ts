import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class GitClient {
  constructor(private readonly repoRoot: string) {}

  async runGitCommand(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: this.repoRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return stdout;
    } catch (error: any) {
      throw new Error(`Git command failed: git ${args.join(' ')}\n${error.message}`);
    }
  }

  async getDiffOutput(staged: boolean): Promise<string> {
    const args = ['diff', '--no-ext-diff', '--color=never'];
    if (staged) {
      args.push('--cached');
    }
    // Note: If no changes, this returns empty string.
    try {
      return await this.runGitCommand(args);
    } catch (e: any) {
      // Sometimes git diff exits with 1 if there are differences but --exit-code is not used. Oh wait, it exits with 0 by default.
      // E.g. git diff returns 0 unless --exit-code.
      throw e;
    }
  }

  async getUntrackedFiles(): Promise<string[]> {
    const args = ['ls-files', '--others', '--exclude-standard'];
    const output = await this.runGitCommand(args);
    return output.split('\n').filter(Boolean);
  }

  async getStatus(): Promise<string> {
    return await this.runGitCommand(['status', '--short', '--porcelain']);
  }
}
