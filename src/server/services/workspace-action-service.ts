import { GitClient } from '../../domain/git/git-client';
import { applyPatch, createPatchForHunk } from '../../domain/git/git-patch';
import { resolveSafePath } from '../utils/safe-path';
import { RepositoryDiffProvider } from '../../domain/diff/providers/repository-diff-provider';

export class WorkspaceActionService {
  private git: GitClient;
  private provider: RepositoryDiffProvider;

  constructor(private repoRoot: string) {
    this.git = new GitClient(repoRoot);
    this.provider = new RepositoryDiffProvider(repoRoot);
  }

  private sanitizePath(targetPath: string): string {
    resolveSafePath(this.repoRoot, targetPath);
    return targetPath;
  }

  async stageFile(file: string): Promise<void> {
    const safeP = this.sanitizePath(file);
    await this.git.runGitCommand(['add', '--', safeP]);
  }

  async unstageFile(file: string): Promise<void> {
    const safeP = this.sanitizePath(file);
    try {
      await this.git.runGitCommand(['rev-parse', 'HEAD']);
      await this.git.runGitCommand(['reset', 'HEAD', '--', safeP]);
    } catch {
      // Fallback for initial commit where HEAD does not exist
      await this.git.runGitCommand(['rm', '--cached', '-f', '--', safeP]);
    }
  }

  async stageHunk(filePath: string, hunkId: string): Promise<void> {
    await this.applyHunkPatch(filePath, hunkId, 'working', false);
  }

  async unstageHunk(filePath: string, hunkId: string): Promise<void> {
    await this.applyHunkPatch(filePath, hunkId, 'staged', true);
  }

  private async applyHunkPatch(
    filePath: string,
    hunkId: string,
    bucket: 'working' | 'staged',
    reverse: boolean,
  ): Promise<void> {
    const files = await this.provider.getFiles(bucket);
    const targetFile = files.find((f) => f.path === filePath);
    if (!targetFile) throw new Error('File not found in diff');

    const targetHunk = targetFile.hunks.find((h) => h.id === hunkId);
    if (!targetHunk) throw new Error('Hunk not found in diff');

    const patch = createPatchForHunk(targetFile, targetHunk);
    await applyPatch(this.git, patch, reverse);
  }
}
