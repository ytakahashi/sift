import { createPatchForHunk } from '../../domain/git/git-patch';
import type { WorkspaceActionService } from '../services/workspace-action-service';
import { RepositoryDiffProvider } from './diff/repository-diff-provider';
import { GitClient } from './git/git-client';
import { applyPatch } from './git/git-patch-applier';
import { resolveSafePath } from './safe-path';

export class WorkspaceActionServiceImpl implements WorkspaceActionService {
  private git: GitClient;
  private provider: RepositoryDiffProvider;

  constructor(private repositoryPath: string) {
    this.git = new GitClient(repositoryPath);
    this.provider = new RepositoryDiffProvider(repositoryPath);
  }

  async stageFile(file: string): Promise<void> {
    const safePath = resolveSafePath(this.repositoryPath, file);
    await this.git.runGitCommand(['add', '--', safePath]);
  }

  async unstageFile(file: string): Promise<void> {
    const safePath = resolveSafePath(this.repositoryPath, file);
    try {
      await this.git.runGitCommand(['rev-parse', 'HEAD']);
      await this.git.runGitCommand(['reset', 'HEAD', '--', safePath]);
    } catch (_error: unknown) {
      // Fallback for initial commit where HEAD does not exist
      await this.git.runGitCommand(['rm', '--cached', '-f', '--', safePath]);
    }
  }

  async stageHunk(filePath: string, hunkId: string): Promise<void> {
    await this.applyHunkPatch(filePath, hunkId, 'working', false);
  }

  async unstageHunk(filePath: string, hunkId: string): Promise<void> {
    await this.applyHunkPatch(filePath, hunkId, 'staged', true);
  }

  async discardWorkingFile(filePath: string): Promise<void> {
    const files = await this.provider.getFiles('working');
    const targetFile = files.find((f) => f.path === filePath);
    if (!targetFile) throw new Error('File not found in working tree');

    const safePath = resolveSafePath(this.repositoryPath, targetFile.path);

    if (targetFile.status === 'untracked') {
      await this.git.cleanPath(safePath);
      return;
    }

    if (targetFile.status === 'submodule') {
      throw new Error('Discard is not supported for submodule changes');
    }

    if (targetFile.status === 'renamed') {
      const oldPath = targetFile.oldPath;
      if (!oldPath) {
        throw new Error('Renamed file is missing oldPath');
      }
      const safeOldPath = resolveSafePath(this.repositoryPath, oldPath);
      await this.git.restoreWorktree([safeOldPath, safePath]);
      return;
    }

    // For tracked working-tree changes (`modified`, `deleted`, `binary`),
    // restore the file content from HEAD.
    await this.git.restoreWorktree([safePath]);
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
