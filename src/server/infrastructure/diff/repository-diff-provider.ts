import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DiffProvider } from '../../../domain/diff/diff-provider';
import { parseDiff } from '../../../domain/diff/diff-parser';
import type { DiffFile, FileBucket, DiffHunk, DiffLine } from '../../../domain/diff/types';
import { GitClient } from '../git/git-client';

const MAX_UNTRACKED_TEXT_DIFF_BYTES = 512 * 1024;

function splitTextFileLines(content: string): string[] {
  if (content === '') {
    return [];
  }

  const lines = content.split('\n');
  if (content.endsWith('\n')) {
    // A trailing newline is a line terminator, not an empty final line.
    lines.pop();
  }

  return lines;
}

export class RepositoryDiffProvider implements DiffProvider {
  private gitClient: GitClient;

  constructor(repoRoot: string) {
    this.gitClient = new GitClient(repoRoot);
  }

  async getFiles(bucket: FileBucket): Promise<DiffFile[]> {
    if (bucket === 'single') {
      return []; // Unsupported by repository provider for now
    }

    const isStaged = bucket === 'staged';
    let rawDiff = '';

    try {
      rawDiff = await this.gitClient.getDiffOutput(isStaged);
    } catch (_error: unknown) {
      // In case diff fails (e.g. empty repo edges)
    }

    const files = rawDiff.trim() ? parseDiff(rawDiff, bucket) : [];

    if (!isStaged) {
      try {
        const untrackedFiles = await this.gitClient.getUntrackedFiles();
        for (const file of untrackedFiles) {
          const absolutePath = path.resolve(this.gitClient.repoRoot, file);
          files.push(await this.createUntrackedFileDiff(file, absolutePath));
        }
      } catch (_error: unknown) {
        // Ignore error
      }
    }

    return files;
  }

  private async createUntrackedFileDiff(file: string, absolutePath: string): Promise<DiffFile> {
    const hunks: DiffHunk[] = [];

    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile() || stats.size > MAX_UNTRACKED_TEXT_DIFF_BYTES) {
        return this.createUntrackedBinaryFile(file);
      }

      const contentBuffer = await fs.readFile(absolutePath);
      if (contentBuffer.includes(0)) {
        return this.createUntrackedBinaryFile(file);
      }

      const content = contentBuffer.toString('utf8');
      const lines = splitTextFileLines(content);
      const diffLines: DiffLine[] = lines.map(
        (line: string, idx: number): DiffLine => ({
          id: `line-${file}-untracked-${idx}`,
          type: 'add',
          newLineNumber: idx + 1,
          content: line,
        }),
      );
      if (diffLines.length > 0) {
        hunks.push({
          id: `hunk-${file}-untracked`,
          header: `@@ -0,0 +1,${lines.length} @@`,
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: lines.length,
          lines: diffLines,
        });
      }
    } catch (_error: unknown) {
      return this.createUntrackedBinaryFile(file);
    }

    return {
      id: `file-${file}`,
      bucket: 'working',
      path: file,
      status: 'untracked',
      kind: 'text',
      displayPath: file,
      hunks,
    };
  }

  private createUntrackedBinaryFile(file: string): DiffFile {
    return {
      id: `file-${file}`,
      bucket: 'working',
      path: file,
      status: 'untracked',
      kind: 'binary',
      displayPath: file,
      hunks: [],
    };
  }
}
