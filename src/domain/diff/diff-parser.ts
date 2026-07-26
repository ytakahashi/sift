import { DiffFile, DiffHunk, DiffLineType, FileBucket } from './types';

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
        files.push(currentFile);
      }

      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const aPath = match ? match[1] : '';
      const bPath = match ? match[2] : '';

      currentFile = {
        id: `file-${bPath}`,
        bucket,
        path: bPath,
        oldPath: aPath !== bPath ? aPath : undefined,
        status: 'modified', // Default, might be updated by subsequent lines
        kind: 'text',
        displayPath: bPath,
        hunks: [],
      };
      // Reset hunk state
      currentHunk = null;
      hunkCounter = 0;
      continue;
    }

    if (!currentFile) continue;

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
      // keep path from bPath, oldPath from aPath
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
      const match = line.match(/^index [0-9a-f]+\.\.([0-9a-f]+)(?: \d{6})?$/);
      if (match) {
        currentFile.newBlobId = match[1];
      }
      continue;
    }

    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      // Standard Git diff headers.
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

    if (currentHunk) {
      if (line.startsWith('\\ No newline at end of file')) {
        continue; // Meta line
      }

      const typeChar = line.charAt(0);
      const isAdd = typeChar === '+';
      const isDel = typeChar === '-';
      const isContext = typeChar === ' ';

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
    }
  }

  if (currentFile) {
    if (currentHunk) {
      currentFile.hunks.push(currentHunk);
    }
    files.push(currentFile);
  }

  return files;
}
