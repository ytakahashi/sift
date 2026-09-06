import type { FileContentProvider, FileContentResult } from '../../services/file-content-provider';
import { isSubmoduleIndexEntry } from '../../services/repository-index-provider';
import { GitClient } from '../git/git-client';
import { readBlobAsText } from './blob-text-reader';

type FileContentGit = Pick<GitClient, 'getIndexEntry' | 'getBlobSize' | 'getBlobContent'>;

export interface RepositoryFileContentProviderOptions {
  git?: FileContentGit;
}

export class RepositoryFileContentProvider implements FileContentProvider {
  private readonly git: FileContentGit;

  constructor(repoRoot: string, options: RepositoryFileContentProviderOptions = {}) {
    this.git = options.git ?? new GitClient(repoRoot);
  }

  async getContent(path: string): Promise<FileContentResult> {
    const entry = await this.git.getIndexEntry(path);
    if (!entry) {
      return { kind: 'not-found' };
    }

    if (isSubmoduleIndexEntry(entry)) {
      return { kind: 'unsupported' };
    }

    const result = await readBlobAsText(this.git, entry.blobId);
    return result.kind === 'file' ? { ...result, blobId: entry.blobId } : result;
  }
}
