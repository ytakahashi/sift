import type { DiffHunk } from './types';

export type UnifiedRow = {
  id: string;
  type: 'context' | 'add' | 'delete' | 'hunk-header';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  hunkId: string;
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
      rows.push({
        id: hunk.id + '-header',
        type: 'hunk-header',
        content: hunk.header,
        hunkId: hunk.id,
      });

      for (const line of hunk.lines) {
        rows.push({
          id: line.id,
          type: line.type,
          oldLineNumber: line.oldLineNumber,
          newLineNumber: line.newLineNumber,
          content: line.content,
          hunkId: hunk.id,
        });
      }
    }
    return rows;
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
