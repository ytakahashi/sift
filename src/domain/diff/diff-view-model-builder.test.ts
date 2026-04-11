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
      // Given: an empty list of hunks
      const hunks: DiffHunk[] = [];

      // When: building the unified view rows
      const rows = DiffViewModelBuilder.buildUnified(hunks);

      // Then: returns an empty array
      expect(rows).toEqual([]);
    });

    it('produces a hunk-header row followed by line rows', () => {
      // Given: a hunk with context, delete, and add lines
      const hunk = createHunk();

      // When: building the unified view rows
      const rows = DiffViewModelBuilder.buildUnified([hunk]);

      // Then: it produces a header row followed by the correctly mapped line rows
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
      // Given: two separate hunks
      const hunk1 = createHunk({ id: 'hunk-1', header: '@@ -1,1 +1,1 @@', lines: [] });
      const hunk2 = createHunk({ id: 'hunk-2', header: '@@ -10,1 +10,1 @@', lines: [] });

      // When: building the unified view rows
      const rows = DiffViewModelBuilder.buildUnified([hunk1, hunk2]);

      // Then: it produces a header row for each hunk
      expect(rows).toHaveLength(2);
      expect(rows[0].hunkId).toBe('hunk-1');
      expect(rows[1].hunkId).toBe('hunk-2');
    });

    it('preserves line numbers from the source', () => {
      // Given: a hunk with specific line numbers
      const hunk = createHunk();

      // When: building the unified view rows
      const rows = DiffViewModelBuilder.buildUnified([hunk]);

      // Then: the row line numbers match the source hunk lines
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
      // Given: an empty list of hunks
      const hunks: DiffHunk[] = [];

      // When: building the split view rows
      const rows = DiffViewModelBuilder.buildSplit(hunks);

      // Then: returns an empty array
      expect(rows).toEqual([]);
    });

    it('sets oldContent only for delete lines and newContent only for add lines', () => {
      // Given: a hunk with context, delete, and add lines
      const hunk = createHunk();

      // When: building the split view rows
      const rows = DiffViewModelBuilder.buildSplit([hunk]);

      // Then: context rows have content on both sides, delete on left, add on right
      // hunk-header
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
