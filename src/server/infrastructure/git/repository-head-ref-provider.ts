import type { HeadRef } from '../../../domain/git/head-ref';
import type { HeadRefProvider } from '../../services/head-ref-provider';
import { GitClient } from './git-client';

/** The Git surface the provider needs; keeps the seam mockable in tests. */
type HeadRefGit = Pick<GitClient, 'getCurrentBranchName' | 'getShortHeadRevision'>;

interface RepositoryHeadRefProviderOptions {
  git?: HeadRefGit;
}

export class RepositoryHeadRefProvider implements HeadRefProvider {
  private readonly git: HeadRefGit;

  constructor(repoRoot: string, options: RepositoryHeadRefProviderOptions = {}) {
    this.git = options.git ?? new GitClient(repoRoot);
  }

  async getHeadRef(): Promise<HeadRef> {
    try {
      const branchName = await this.git.getCurrentBranchName();
      if (branchName !== '') {
        return { type: 'branch', name: branchName };
      }

      // An empty branch name means HEAD is detached, so identify it by revision.
      const revision = await this.git.getShortHeadRevision();
      return revision === '' ? { type: 'unknown' } : { type: 'detached', revision };
    } catch (_error: unknown) {
      // Mirrors how the diff provider suppresses Git failures: HEAD travels with
      // the diff as a display-only detail, so failing to read it must not fail
      // the diff itself. The client renders nothing for an unknown HEAD.
      return { type: 'unknown' };
    }
  }
}
