import { describe, it, expect } from 'vitest';
import { DiffViewModelBuilder } from './diff-view-model-builder';
import type { DiffHunk } from './types';

function createHunk(overrides: Partial<DiffHunk> = {}): DiffHunk {
  return {
    id: 'hunk-1',
    header: '@@ -1,3 +1,3 @@',
    oldStart: 1,
    oldLines: 3,
    newStart: 1,
    newLines: 3,
    lines: [
      { id: 'line-1', type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'ctx' },
      { id: 'line-2', type: 'delete', oldLineNumber: 2, content: 'old' },
      { id: 'line-3', type: 'add', newLineNumber: 2, content: 'new' },
      { id: 'line-4', type: 'context', oldLineNumber: 3, newLineNumber: 3, content: 'ctx2' },
    ],
    ...overrides,
  };
}

describe('DiffViewModelBuilder', () => {
  describe('buildUnified', () => {
    it('returns an empty array for empty hunks', () => {
      expect(DiffViewModelBuilder.buildUnified([])).toEqual([]);
    });

    it('produces a hunk-header row followed by line rows', () => {
      const rows = DiffViewModelBuilder.buildUnified([createHunk()]);

      expect(rows).toHaveLength(5); // 1 header + 4 lines
      expect(rows[0].type).toBe('hunk-header');
      expect(rows[0].content).toBe('@@ -1,3 +1,3 @@');
      expect(rows[0].hunkId).toBe('hunk-1');

      expect(rows[1]).toMatchObject({ type: 'context', content: 'ctx', hunkId: 'hunk-1' });
      expect(rows[2]).toMatchObject({ type: 'delete', content: 'old' });
      expect(rows[3]).toMatchObject({ type: 'add', content: 'new' });
      expect(rows[4]).toMatchObject({ type: 'context', content: 'ctx2' });
    });

    it('handles multiple hunks with separate headers', () => {
      const hunk1 = createHunk({ id: 'hunk-1', header: '@@ -1,1 +1,1 @@', lines: [] });
      const hunk2 = createHunk({ id: 'hunk-2', header: '@@ -10,1 +10,1 @@', lines: [] });

      const rows = DiffViewModelBuilder.buildUnified([hunk1, hunk2]);
      expect(rows).toHaveLength(2);
      expect(rows[0].hunkId).toBe('hunk-1');
      expect(rows[1].hunkId).toBe('hunk-2');
    });

    it('preserves line numbers from the source', () => {
      const rows = DiffViewModelBuilder.buildUnified([createHunk()]);

      expect(rows[1].oldLineNumber).toBe(1);
      expect(rows[1].newLineNumber).toBe(1);
      expect(rows[2].oldLineNumber).toBe(2);
      expect(rows[2].newLineNumber).toBeUndefined();
      expect(rows[3].oldLineNumber).toBeUndefined();
      expect(rows[3].newLineNumber).toBe(2);
    });
  });

  describe('buildSplit', () => {
    it('returns an empty array for empty hunks', () => {
      expect(DiffViewModelBuilder.buildSplit([])).toEqual([]);
    });

    it('sets oldContent only for delete lines and newContent only for add lines', () => {
      const rows = DiffViewModelBuilder.buildSplit([createHunk()]);

      // header
      expect(rows[0].type).toBe('hunk-header');

      // context: both sides
      expect(rows[1].oldContent).toBe('ctx');
      expect(rows[1].newContent).toBe('ctx');

      // delete: oldContent only
      expect(rows[2].oldContent).toBe('old');
      expect(rows[2].newContent).toBeUndefined();

      // add: newContent only
      expect(rows[3].oldContent).toBeUndefined();
      expect(rows[3].newContent).toBe('new');

      // context: both sides
      expect(rows[4].oldContent).toBe('ctx2');
      expect(rows[4].newContent).toBe('ctx2');
    });
  });
});
