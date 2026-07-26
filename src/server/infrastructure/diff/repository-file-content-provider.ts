import {
  MAX_FULL_FILE_VIEW_LINES,
  MAX_TEXT_DIFF_BYTES,
} from '../../../domain/diff/file-content-limits';
import { splitTextFileLines } from '../../../domain/diff/text-file-lines';
import type { FileContentProvider, FileContentResult } from '../../services/file-content-provider';
import { GitClient } from '../git/git-client';

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

    // Mode 160000 points at a commit object for a submodule, not file contents.
    if (entry.mode === '160000') {
      return { kind: 'unsupported' };
    }

    const size = await this.git.getBlobSize(entry.blobId);
    if (size > MAX_TEXT_DIFF_BYTES) {
      return { kind: 'too-large' };
    }

    const content = await this.git.getBlobContent(entry.blobId);
    if (content.includes(0)) {
      return { kind: 'unsupported' };
    }

    const lines = splitTextFileLines(content.toString('utf8'));
    if (lines.length > MAX_FULL_FILE_VIEW_LINES) {
      return { kind: 'too-large' };
    }

    return { kind: 'file', blobId: entry.blobId, lines };
  }
}
