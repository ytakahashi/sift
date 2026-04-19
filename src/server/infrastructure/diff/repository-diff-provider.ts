import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DiffProvider } from '../../../domain/diff/providers/diff-provider';
import { parseDiff } from '../../../domain/diff/diff-parser';
import type { DiffFile, FileBucket, DiffHunk, DiffLine } from '../../../domain/diff/types';
import { GitClient } from '../git/git-client';

export class RepositoryDiffProvider implements DiffProvider {
  private gitClient: GitClient;

  constructor(repoRoot: string) {
    this.gitClient = new GitClient(repoRoot);
  }

  async validate(): Promise<boolean> {
    try {
      // Just run a simple git command to ensure it's a valid repo
      await this.gitClient.runGitCommand(['rev-parse', '--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  async getFiles(bucket: FileBucket): Promise<DiffFile[]> {
    if (bucket === 'single') {
      return []; // Unsupported by repository provider for now
    }

    const isStaged = bucket === 'staged';
    let rawDiff = '';

    try {
      rawDiff = await this.gitClient.getDiffOutput(isStaged);
    } catch {
      // In case diff fails (e.g. empty repo edges)
    }

    const files = rawDiff.trim() ? parseDiff(rawDiff, bucket) : [];

    if (!isStaged) {
      try {
        const untrackedFiles = await this.gitClient.getUntrackedFiles();
        for (const file of untrackedFiles) {
          const hunks: DiffHunk[] = [];
          try {
            const absolutePath = path.resolve(this.gitClient.repoRoot, file);
            const content: string = await fs.readFile(absolutePath, 'utf8');
            const lines: string[] = content.split('\n');
            const diffLines: DiffLine[] = lines.map(
              (line: string, idx: number): DiffLine => ({
                id: `line-${file}-untracked-${idx}`,
                type: 'add',
                newLineNumber: idx + 1,
                content: line,
              }),
            );
            hunks.push({
              id: `hunk-${file}-untracked`,
              header: `@@ -0,0 +1,${lines.length} @@`,
              oldStart: 0,
              oldLines: 0,
              newStart: 1,
              newLines: lines.length,
              lines: diffLines,
            });
          } catch {
            // File might be binary or unreadable, leave hunks empty
          }

          files.push({
            id: `file-${file}`,
            bucket: 'working',
            path: file,
            status: 'untracked',
            kind: 'text',
            displayPath: file,
            hunks,
          });
        }
      } catch {
        // Ignore error
      }
    }

    return files;
  }
}
