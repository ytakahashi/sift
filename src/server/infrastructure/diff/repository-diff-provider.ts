import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DiffProvider } from '../../../domain/diff/diff-provider';
import { parseDiff } from '../../../domain/diff/diff-parser';
import { MAX_TEXT_DIFF_BYTES } from '../../../domain/diff/file-content-limits';
import { splitTextFileLines } from '../../../domain/diff/text-file-lines';
import type { DiffFile, FileBucket, DiffHunk, DiffLine } from '../../../domain/diff/types';
import { GitClient } from '../git/git-client';

export interface RepositoryDiffProviderOptions {
  /**
   * The diff viewer historically treats Git/filesystem failures as an empty
   * result. Consumers that make destructive decisions from file absence must
   * instead receive those failures and abort their operation.
   */
  errorMode?: 'suppress' | 'throw';
}

export class RepositoryDiffProvider implements DiffProvider {
  private gitClient: GitClient;
  private readonly errorMode: 'suppress' | 'throw';

  constructor(repoRoot: string, options: RepositoryDiffProviderOptions = {}) {
    this.gitClient = new GitClient(repoRoot);
    this.errorMode = options.errorMode ?? 'suppress';
  }

  async getFiles(bucket: FileBucket): Promise<DiffFile[]> {
    if (bucket === 'single') {
      return []; // Unsupported by repository provider for now
    }

    const isStaged = bucket === 'staged';
    let rawDiff = '';

    try {
      rawDiff = await this.gitClient.getDiffOutput(isStaged);
    } catch (error: unknown) {
      if (this.errorMode === 'throw') {
        throw error;
      }
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
      } catch (error: unknown) {
        if (this.errorMode === 'throw') {
          throw error;
        }
        // Ignore error
      }
    }

    return files;
  }

  private async createUntrackedFileDiff(file: string, absolutePath: string): Promise<DiffFile> {
    const hunks: DiffHunk[] = [];

    try {
      // lstat (not stat) so a symlink is classified as itself rather than
      // followed to whatever it points at, which may sit outside the repo.
      const stats = await fs.lstat(absolutePath);

      if (stats.isSymbolicLink()) {
        // Mirror how tracked symlinks already render: the link target string
        // as the file's single line of content, never the pointed-to file.
        const target = await fs.readlink(absolutePath);
        hunks.push({
          id: `hunk-${file}-untracked`,
          header: '@@ -0,0 +1,1 @@',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 1,
          lines: [
            {
              id: `line-${file}-untracked-0`,
              type: 'add',
              newLineNumber: 1,
              content: target,
            },
          ],
        });
      } else {
        if (!stats.isFile() || stats.size > MAX_TEXT_DIFF_BYTES) {
          return this.createUntrackedBinaryFile(file);
        }

        const contentBuffer = await fs.readFile(absolutePath);
        if (contentBuffer.includes(0)) {
          return this.createUntrackedBinaryFile(file);
        }

        const content = contentBuffer.toString('utf8');
        const lines = splitTextFileLines(content);
        const diffLines: DiffLine[] = lines.map((line: string, idx: number): DiffLine => ({
          id: `line-${file}-untracked-${idx}`,
          type: 'add',
          newLineNumber: idx + 1,
          content: line,
        }));
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
      }
    } catch (error: unknown) {
      if (this.errorMode === 'throw') {
        throw error;
      }
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
