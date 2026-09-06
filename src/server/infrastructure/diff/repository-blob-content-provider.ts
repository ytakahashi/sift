import type { BlobContentProvider, BlobContentResult } from '../../services/blob-content-provider';
import { GitClient } from '../git/git-client';
import { readBlobAsText } from './blob-text-reader';

type BlobContentGit = Pick<GitClient, 'getObjectType' | 'getBlobSize' | 'getBlobContent'>;

export interface RepositoryBlobContentProviderOptions {
  git?: BlobContentGit;
}

export class RepositoryBlobContentProvider implements BlobContentProvider {
  private readonly git: BlobContentGit;

  constructor(repoRoot: string, options: RepositoryBlobContentProviderOptions = {}) {
    this.git = options.git ?? new GitClient(repoRoot);
  }

  async getContent(blobId: string): Promise<BlobContentResult> {
    const objectType = await this.git.getObjectType(blobId);
    if (objectType !== 'blob') {
      return { kind: 'not-found' };
    }

    return readBlobAsText(this.git, blobId);
  }
}
