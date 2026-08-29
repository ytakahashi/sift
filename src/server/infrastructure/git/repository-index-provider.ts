import type {
  RepositoryIndexEntry,
  RepositoryIndexProvider,
} from '../../services/repository-index-provider';
import { GitClient } from './git-client';

type RepositoryIndexGit = Pick<GitClient, 'getIndexEntry'>;

export interface GitRepositoryIndexProviderOptions {
  git?: RepositoryIndexGit;
}

export class GitRepositoryIndexProvider implements RepositoryIndexProvider {
  private readonly git: RepositoryIndexGit;

  constructor(repoRoot: string, options: GitRepositoryIndexProviderOptions = {}) {
    this.git = options.git ?? new GitClient(repoRoot);
  }

  async getIndexEntry(path: string): Promise<RepositoryIndexEntry | null> {
    return await this.git.getIndexEntry(path);
  }
}
