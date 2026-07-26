import type { DiffHunk } from './types';

export type UnifiedRow = {
  id: string;
  type: 'context' | 'add' | 'delete' | 'hunk-header';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  hunkId: string;
  origin: 'hunk' | 'expanded-context';
};

export type SplitRow = {
  id: string;
  type: 'context' | 'add' | 'delete' | 'modify' | 'hunk-header';
  oldLineNumber?: number;
  newLineNumber?: number;
  oldContent?: string;
  newContent?: string;
  hunkId: string;
};

export class DiffViewModelBuilder {
  static buildUnified(hunks: DiffHunk[]): UnifiedRow[] {
    const rows: UnifiedRow[] = [];
    for (const hunk of hunks) {
      rows.push(...this.buildUnifiedHunk(hunk));
    }
    return rows;
  }

  static buildUnifiedFullFile(hunks: DiffHunk[], fileLines: string[]): UnifiedRow[] {
    const rows: UnifiedRow[] = [];
    let newLineCursor = 1;
    let offset = 0;

    const pushContextRange = (
      fromNewLine: number,
      toNewLine: number,
      hunkId: string,
      oldLineOffset: number,
    ): void => {
      for (let lineNumber = fromNewLine; lineNumber <= toNewLine; lineNumber++) {
        rows.push({
          id: `context-full-${hunkId}-${lineNumber}`,
          type: 'context',
          oldLineNumber: lineNumber - oldLineOffset,
          newLineNumber: lineNumber,
          content: fileLines[lineNumber - 1] ?? '',
          hunkId,
          origin: 'expanded-context',
        });
      }
    };

    for (const hunk of hunks) {
      pushContextRange(newLineCursor, hunk.newStart - 1, hunk.id, offset);
      rows.push(...this.buildUnifiedHunk(hunk));
      newLineCursor = hunk.newStart + hunk.newLines;
      offset = hunk.newStart + hunk.newLines - (hunk.oldStart + hunk.oldLines);
    }

    pushContextRange(
      newLineCursor,
      fileLines.length,
      hunks[hunks.length - 1]?.id ?? 'tail',
      offset,
    );

    return rows;
  }

  private static buildUnifiedHunk(hunk: DiffHunk): UnifiedRow[] {
    return [
      {
        id: hunk.id + '-header',
        type: 'hunk-header',
        content: hunk.header,
        hunkId: hunk.id,
        origin: 'hunk',
      },
      ...hunk.lines.map(
        (line): UnifiedRow => ({
          id: line.id,
          type: line.type,
          oldLineNumber: line.oldLineNumber,
          newLineNumber: line.newLineNumber,
          content: line.content,
          hunkId: hunk.id,
          origin: 'hunk',
        }),
      ),
    ];
  }

  static buildSplit(hunks: DiffHunk[]): SplitRow[] {
    // Basic placeholder implementation for split rows.
    // Real implementation would align additions and deletions side by side.
    const rows: SplitRow[] = [];
    for (const hunk of hunks) {
      rows.push({
        id: hunk.id + '-header',
        type: 'hunk-header',
        hunkId: hunk.id,
        oldContent: hunk.header,
        newContent: hunk.header,
      });
      // A naive translation for now. Proper pairing of added/deleted lines goes here.
      for (const line of hunk.lines) {
        rows.push({
          id: line.id,
          type: line.type,
          oldLineNumber: line.oldLineNumber,
          newLineNumber: line.newLineNumber,
          oldContent: line.type !== 'add' ? line.content : undefined,
          newContent: line.type !== 'delete' ? line.content : undefined,
          hunkId: hunk.id,
        });
      }
    }
    return rows;
  }
}
