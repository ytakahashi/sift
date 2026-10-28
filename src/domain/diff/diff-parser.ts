import { DiffFile, DiffHunk, DiffLineType, FileBucket } from './types';
import { createDiffFileId } from './file-id';
import { decodeGitPath, parseGitDiffPaths } from '../git/git-path';

function finishFile(file: DiffFile): DiffFile {
  file.id = createDiffFileId(file.path);
  file.displayPath = file.path;
  if (file.oldPath === file.path) file.oldPath = undefined;
  return file;
}

export function parseDiff(rawDiff: string, bucket: FileBucket): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = rawDiff.split('\n');

  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;

  let oldLineNum = 0;
  let newLineNum = 0;
  let hunkCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('diff --git ')) {
      if (currentFile) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }
        files.push(finishFile(currentFile));
      }

      const [aPath, bPath] = parseGitDiffPaths(line);

      // Later headers may refine the paths, so finishFile derives id and displayPath.
      currentFile = {
        id: '',
        bucket,
        path: bPath,
        oldPath: aPath,
        status: 'modified', // Default, might be updated by subsequent lines
        kind: 'text',
        displayPath: '',
        hunks: [],
      };
      // Reset hunk state
      currentHunk = null;
      hunkCounter = 0;
      continue;
    }

    if (!currentFile) continue;

    // "\ No newline at end of file" follows the last line of a side, possibly after both declared
    // line counts are consumed, so it is checked before the hunk-range test below.
    if (currentHunk && line.startsWith('\\')) {
      const previousLine = currentHunk.lines.at(-1);
      if (previousLine) {
        previousLine.noNewlineAtEnd = true;
      }
      continue;
    }

    // Hunk content can look like file headers (e.g. deleting "-- comment").
    // Use both declared line counts so additions still parse after deletions exhaust the old side.
    if (
      currentHunk &&
      (oldLineNum < currentHunk.oldStart + currentHunk.oldLines ||
        newLineNum < currentHunk.newStart + currentHunk.newLines)
    ) {
      const typeChar = line.charAt(0);
      const isAdd = typeChar === '+';
      const isDel = typeChar === '-';
      // diff.suppressBlankEmpty emits empty context lines as "" instead of " ".
      const isContext = typeChar === ' ' || line === '';

      if (isAdd || isDel || isContext) {
        let type: DiffLineType;
        let oNum: number | undefined = undefined;
        let nNum: number | undefined = undefined;

        if (isAdd) {
          type = 'add';
          nNum = newLineNum++;
        } else if (isDel) {
          type = 'delete';
          oNum = oldLineNum++;
        } else {
          type = 'context';
          oNum = oldLineNum++;
          nNum = newLineNum++;
        }

        currentHunk.lines.push({
          id: `line-${currentHunk.id}-${currentHunk.lines.length}`,
          type,
          oldLineNumber: oNum,
          newLineNumber: nNum,
          content: line.substring(1),
        });
      }
      continue;
    }

    if (line.startsWith('new file mode ')) {
      currentFile.status = 'added';
      currentFile.kind = 'text'; // unless binary
      continue;
    }
    if (line.startsWith('deleted file mode ')) {
      currentFile.status = 'deleted';
      continue;
    }
    if (line.startsWith('rename from ')) {
      currentFile.status = 'renamed';
      currentFile.oldPath = decodeGitPath(line.slice(12));
      continue;
    }
    if (line.startsWith('rename to ')) {
      currentFile.path = decodeGitPath(line.slice(10));
      continue;
    }
    if (line.startsWith('similarity index ')) {
      // part of rename or copy
      continue;
    }
    if (line.startsWith('Binary files ')) {
      currentFile.kind = 'binary';
      currentFile.status = currentFile.status === 'modified' ? 'binary' : currentFile.status;
      continue;
    }
    if (line.startsWith('Submodule ')) {
      currentFile.kind = 'submodule';
      currentFile.status = 'submodule';
      continue;
    }

    if (line.startsWith('index ')) {
      const match = line.match(/^index ([0-9a-f]+)\.\.([0-9a-f]+)(?: \d{6})?$/);
      if (match) {
        currentFile.oldBlobId = match[1];
        currentFile.newBlobId = match[2];
      }
      continue;
    }

    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      if (!currentHunk) {
        // Unquoted paths may end with a tab separator; quoted tabs belong to the path.
        const path = decodeGitPath(line.slice(4).split('\t')[0]);
        if (path !== '/dev/null') {
          if (line.startsWith('--- ')) currentFile.oldPath = path.slice(2);
          else currentFile.path = path.slice(2);
        }
      }
      continue;
    }

    if (line.startsWith('@@ ')) {
      const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
      if (match) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }
        hunkCounter++;

        const oldStart = parseInt(match[1], 10);
        const oldLines = match[2] ? parseInt(match[2], 10) : 1;
        const newStart = parseInt(match[3], 10);
        const newLines = match[4] ? parseInt(match[4], 10) : 1;
        const header = match[5]?.trim() || '';

        currentHunk = {
          id: `hunk-${currentFile.path}-${hunkCounter}`,
          header: `@@ -${oldStart}${match[2] ? ',' + match[2] : ''} +${newStart}${match[4] ? ',' + match[4] : ''} @@ ${header}`,
          oldStart,
          oldLines,
          newStart,
          newLines,
          lines: [],
        };

        oldLineNum = oldStart;
        newLineNum = newStart;
        continue;
      }
    }
  }

  if (currentFile) {
    if (currentHunk) {
      currentFile.hunks.push(currentHunk);
    }
    files.push(finishFile(currentFile));
  }

  return files;
}
