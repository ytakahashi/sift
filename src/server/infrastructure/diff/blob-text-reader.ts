import {
  MAX_FULL_FILE_VIEW_LINES,
  MAX_TEXT_DIFF_BYTES,
} from '../../../domain/diff/file-content-limits';
import { splitTextFileLines } from '../../../domain/diff/text-file-lines';
import type { GitClient } from '../git/git-client';

export type BlobTextReadResult =
  { kind: 'file'; lines: string[] } | { kind: 'too-large' } | { kind: 'unsupported' };

type BlobTextGit = Pick<GitClient, 'getBlobSize' | 'getBlobContent'>;

export async function readBlobAsText(
  git: BlobTextGit,
  blobId: string,
): Promise<BlobTextReadResult> {
  const size = await git.getBlobSize(blobId);
  if (size > MAX_TEXT_DIFF_BYTES) {
    return { kind: 'too-large' };
  }

  const content = await git.getBlobContent(blobId);
  if (content.includes(0)) {
    return { kind: 'unsupported' };
  }

  const lines = splitTextFileLines(content.toString('utf8'));
  if (lines.length > MAX_FULL_FILE_VIEW_LINES) {
    return { kind: 'too-large' };
  }

  return { kind: 'file', lines };
}
