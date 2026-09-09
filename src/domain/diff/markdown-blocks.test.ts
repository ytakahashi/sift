import { describe, expect, it } from 'vitest';
import type { DiffHunk, DiffLine } from './types';
import {
  buildMarkdownPreviewRows,
  classifyMarkdownBlocks,
  type ClassifiedMarkdownBlock,
  type MarkdownBlock,
} from './markdown-blocks';

function createBlock(startLine: number, endLine: number): MarkdownBlock {
  return {
    id: `paragraph-${startLine}-${endLine}`,
    startLine,
    endLine,
    raw: `block ${startLine}`,
  };
}

function createHunk(lines: DiffLine[]): DiffHunk {
  return {
    id: 'hunk-1',
    header: '',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines,
  };
}

function createClassifiedBlock(
  startLine: number,
  endLine: number,
  status: ClassifiedMarkdownBlock['status'] = 'changed',
): ClassifiedMarkdownBlock {
  return {
    ...createBlock(startLine, endLine),
    status,
  };
}

function createPreviewHunk(
  id: string,
  oldStart: number,
  newStart: number,
  lines: DiffLine[],
): DiffHunk {
  return {
    id,
    header: '',
    oldStart,
    oldLines: lines.filter((line) => line.type !== 'add').length,
    newStart,
    newLines: lines.filter((line) => line.type !== 'delete').length,
    lines,
  };
}

describe('classifyMarkdownBlocks', () => {
  it('marks new blocks that overlap added lines', () => {
    // Given
    const blocks = [createBlock(2, 4), createBlock(6, 6)];
    const hunks = [
      createHunk([
        { id: 'line-1', type: 'add', newLineNumber: 4, content: 'changed' },
        {
          id: 'line-2',
          type: 'delete',
          oldLineNumber: 6,
          content: 'old',
        },
      ]),
    ];

    // When
    const result = classifyMarkdownBlocks(blocks, hunks, 'new');

    // Then
    expect(result.map((block) => block.status)).toEqual(['changed', 'unchanged']);
  });

  it('marks old blocks that overlap deleted lines', () => {
    // Given
    const blocks = [createBlock(2, 4), createBlock(6, 6)];
    const hunks = [
      createHunk([
        { id: 'line-1', type: 'delete', oldLineNumber: 2, content: 'changed' },
        { id: 'line-2', type: 'add', newLineNumber: 6, content: 'new' },
      ]),
    ];

    // When
    const result = classifyMarkdownBlocks(blocks, hunks, 'old');

    // Then
    expect(result.map((block) => block.status)).toEqual(['changed', 'unchanged']);
  });

  it('treats changes on both inclusive block boundaries as overlapping', () => {
    // Given
    const blocks = [createBlock(2, 4)];
    const hunks = [
      createHunk([
        { id: 'line-1', type: 'add', newLineNumber: 2, content: 'start' },
        { id: 'line-2', type: 'add', newLineNumber: 4, content: 'end' },
      ]),
    ];

    // When / Then
    expect(classifyMarkdownBlocks(blocks, hunks, 'new')[0].status).toBe('changed');
  });

  it('ignores context and opposite-side changes', () => {
    // Given
    const blocks = [createBlock(1, 3)];
    const hunks = [
      createHunk([
        {
          id: 'line-1',
          type: 'context',
          oldLineNumber: 1,
          newLineNumber: 1,
          content: 'context',
        },
        { id: 'line-2', type: 'delete', oldLineNumber: 2, content: 'deleted' },
        { id: 'line-3', type: 'add', newLineNumber: 4, content: 'outside block' },
      ]),
    ];

    // When
    const result = classifyMarkdownBlocks(blocks, hunks, 'new');

    // Then
    expect(result[0].status).toBe('unchanged');
  });

  it.each([
    {
      line: { id: 'line-1', type: 'add', content: 'added' } satisfies DiffLine,
      missingField: 'newLineNumber',
    },
    {
      line: { id: 'line-2', type: 'delete', content: 'deleted' } satisfies DiffLine,
      missingField: 'oldLineNumber',
    },
    {
      line: {
        id: 'line-3',
        type: 'context',
        newLineNumber: 1,
        content: 'context',
      } satisfies DiffLine,
      missingField: 'oldLineNumber',
    },
    {
      line: {
        id: 'line-4',
        type: 'context',
        oldLineNumber: 1,
        content: 'context',
      } satisfies DiffLine,
      missingField: 'newLineNumber',
    },
  ])('rejects a diff line missing $missingField', ({ line, missingField }) => {
    // Given
    const blocks = [createBlock(1, 1)];

    // When / Then
    expect(() => classifyMarkdownBlocks(blocks, [createHunk([line])], 'new')).toThrow(
      `is missing ${missingField}`,
    );
  });

  it('combines changes from multiple hunks', () => {
    // Given
    const blocks = [createBlock(1, 1), createBlock(3, 3)];
    const hunks = [
      createPreviewHunk('hunk-1', 1, 1, [
        { id: 'line-1', type: 'add', newLineNumber: 1, content: 'first' },
      ]),
      createPreviewHunk('hunk-2', 3, 3, [
        { id: 'line-2', type: 'add', newLineNumber: 3, content: 'second' },
      ]),
    ];

    // When
    const result = classifyMarkdownBlocks(blocks, hunks, 'new');

    // Then
    expect(result.map((block) => block.status)).toEqual(['changed', 'changed']);
  });

  it('assigns a changed separator line to both adjacent blocks', () => {
    // Given
    const blocks = [createBlock(1, 1), createBlock(3, 3)];
    const hunks = [createHunk([{ id: 'line-1', type: 'add', newLineNumber: 2, content: '' }])];

    // When
    const result = classifyMarkdownBlocks(blocks, hunks, 'new');

    // Then
    expect(result.map((block) => block.status)).toEqual(['changed', 'changed']);
  });

  it('marks both old neighbors for a deleted separator while leaving the new side unchanged', () => {
    // Given: deleting only the separator merges two old paragraphs without adding a new-side line
    const oldBlocks = [createBlock(1, 1), createBlock(3, 3)];
    const newBlocks = [createBlock(1, 2)];
    const hunks = [createHunk([{ id: 'line-1', type: 'delete', oldLineNumber: 2, content: '' }])];

    // When
    const oldResult = classifyMarkdownBlocks(oldBlocks, hunks, 'old');
    const newResult = classifyMarkdownBlocks(newBlocks, hunks, 'new');

    // Then: Git reports only a deletion, so no semantic cross-side re-diff marks the new block
    expect(oldResult.map((block) => block.status)).toEqual(['changed', 'changed']);
    expect(newResult.map((block) => block.status)).toEqual(['unchanged']);
  });

  it('does not associate inconsistent non-whitespace gap content with a block', () => {
    // Given: source-derived blocks cannot normally leave non-whitespace content in a gap
    const blocks = [createBlock(1, 1), createBlock(3, 3)];
    const hunks = [
      createHunk([{ id: 'line-1', type: 'add', newLineNumber: 2, content: 'orphaned' }]),
    ];

    // When
    const result = classifyMarkdownBlocks(blocks, hunks, 'new');

    // Then
    expect(result.map((block) => block.status)).toEqual(['unchanged', 'unchanged']);
  });

  it('assigns leading and trailing changed blank lines to the nearest block', () => {
    // Given
    const blocks = [createBlock(2, 2)];
    const hunks = [
      createHunk([
        { id: 'line-1', type: 'add', newLineNumber: 1, content: '' },
        { id: 'line-2', type: 'add', newLineNumber: 3, content: '' },
      ]),
    ];

    // When / Then
    expect(classifyMarkdownBlocks(blocks, hunks, 'new')[0].status).toBe('changed');
  });

  it('returns new objects without mutating input blocks', () => {
    // Given
    const blocks = [createBlock(1, 1)];
    const hunks = [
      createHunk([{ id: 'line-1', type: 'add', newLineNumber: 1, content: 'changed' }]),
    ];

    // When
    const result = classifyMarkdownBlocks(blocks, hunks, 'new');

    // Then
    expect(result[0]).not.toBe(blocks[0]);
    expect(blocks[0]).not.toHaveProperty('status');
  });

  it('returns an empty array when there are no markdown blocks', () => {
    // Given / When
    const result = classifyMarkdownBlocks([], [createHunk([])], 'new');

    // Then
    expect(result).toEqual([]);
  });

  it('rejects block ranges that cannot define adjacent whitespace', () => {
    // Given
    const blocks = [createBlock(3, 4), createBlock(2, 2)];

    // When / Then
    expect(() => classifyMarkdownBlocks(blocks, [], 'new')).toThrow(
      'Markdown block at index 1 ("paragraph-2-2", lines 2-2) is invalid; blocks must be ordered and non-overlapping. Previous block "paragraph-3-4" spans lines 3-4.',
    );
  });
});

describe('buildMarkdownPreviewRows', () => {
  it('returns new blocks in source order when there are no hunks', () => {
    // Given
    const newBlocks = [
      createClassifiedBlock(1, 1, 'unchanged'),
      createClassifiedBlock(3, 3, 'unchanged'),
    ];

    // When
    const result = buildMarkdownPreviewRows(newBlocks, [], []);

    // Then
    expect(result).toEqual([
      { kind: 'new', block: newBlocks[0] },
      { kind: 'new', block: newBlocks[1] },
    ]);
  });

  it('places a removed block at the deletion boundary rather than the hunk start', () => {
    // Given: the hunk starts with context two lines before the replacement
    const oldBlock = createClassifiedBlock(3, 3);
    const newBlocks = [
      createClassifiedBlock(1, 1, 'unchanged'),
      createClassifiedBlock(3, 3),
      createClassifiedBlock(5, 5, 'unchanged'),
    ];
    const hunk = createPreviewHunk('hunk-1', 1, 1, [
      { id: 'line-1', type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'a' },
      { id: 'line-2', type: 'context', oldLineNumber: 2, newLineNumber: 2, content: '' },
      { id: 'line-3', type: 'delete', oldLineNumber: 3, content: 'old' },
      { id: 'line-4', type: 'add', newLineNumber: 3, content: 'new' },
    ]);

    // When
    const result = buildMarkdownPreviewRows(newBlocks, [oldBlock], [hunk]);

    // Then
    expect(result.map((row) => [row.kind, row.block.startLine])).toEqual([
      ['new', 1],
      ['removed', 3],
      ['new', 3],
      ['new', 5],
    ]);
  });

  it('places a removal before a new block that contains its insertion boundary', () => {
    // Given
    const oldBlock = createClassifiedBlock(2, 2);
    const newBlock = createClassifiedBlock(1, 5);
    const hunk = createPreviewHunk('hunk-1', 1, 1, [
      { id: 'line-1', type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'a' },
      { id: 'line-2', type: 'delete', oldLineNumber: 2, content: 'old' },
      { id: 'line-3', type: 'add', newLineNumber: 2, content: 'new' },
    ]);

    // When
    const result = buildMarkdownPreviewRows([newBlock], [oldBlock], [hunk]);

    // Then
    expect(result).toEqual([
      { kind: 'removed', block: oldBlock },
      { kind: 'new', block: newBlock },
    ]);
  });

  it('preserves deletion order across consecutive hunks', () => {
    // Given
    const firstOldBlock = createClassifiedBlock(2, 2);
    const secondOldBlock = createClassifiedBlock(4, 4);
    const newBlocks = [
      createClassifiedBlock(1, 1, 'unchanged'),
      createClassifiedBlock(3, 3, 'unchanged'),
      createClassifiedBlock(5, 5, 'unchanged'),
    ];
    const hunks = [
      createPreviewHunk('hunk-1', 2, 2, [
        { id: 'line-1', type: 'delete', oldLineNumber: 2, content: 'first' },
      ]),
      createPreviewHunk('hunk-2', 4, 4, [
        { id: 'line-2', type: 'delete', oldLineNumber: 4, content: 'second' },
      ]),
    ];

    // When
    const result = buildMarkdownPreviewRows(newBlocks, [firstOldBlock, secondOldBlock], hunks);

    // Then
    expect(result.map((row) => [row.kind, row.block.startLine])).toEqual([
      ['new', 1],
      ['removed', 2],
      ['new', 3],
      ['removed', 4],
      ['new', 5],
    ]);
  });

  it('emits an old block only once when it is changed in multiple hunks', () => {
    // Given
    const oldBlock = createClassifiedBlock(1, 10);
    const newBlock = createClassifiedBlock(1, 10);
    const hunks = [
      createPreviewHunk('hunk-1', 2, 2, [
        { id: 'line-1', type: 'delete', oldLineNumber: 2, content: 'first' },
      ]),
      createPreviewHunk('hunk-2', 8, 8, [
        { id: 'line-2', type: 'delete', oldLineNumber: 8, content: 'second' },
      ]),
    ];

    // When
    const result = buildMarkdownPreviewRows([newBlock], [oldBlock], hunks);

    // Then
    expect(result).toEqual([
      { kind: 'removed', block: oldBlock },
      { kind: 'new', block: newBlock },
    ]);
  });

  it('associates a deleted blank separator with both old neighbors', () => {
    // Given
    const oldBlocks = [createClassifiedBlock(1, 1), createClassifiedBlock(3, 3)];
    const newBlock = createClassifiedBlock(1, 2, 'unchanged');
    const hunk = createPreviewHunk('hunk-1', 1, 1, [
      { id: 'line-1', type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'a' },
      { id: 'line-2', type: 'delete', oldLineNumber: 2, content: '' },
      { id: 'line-3', type: 'context', oldLineNumber: 3, newLineNumber: 2, content: 'b' },
    ]);

    // When
    const result = buildMarkdownPreviewRows([newBlock], oldBlocks, [hunk]);

    // Then
    expect(result).toEqual([
      { kind: 'removed', block: oldBlocks[0] },
      { kind: 'removed', block: oldBlocks[1] },
      { kind: 'new', block: newBlock },
    ]);
  });

  it('does not create removed rows for an addition-only hunk', () => {
    // Given
    const oldBlock = createClassifiedBlock(1, 1, 'unchanged');
    const newBlock = createClassifiedBlock(1, 2);
    const hunk = createPreviewHunk('hunk-1', 1, 1, [
      { id: 'line-1', type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'a' },
      { id: 'line-2', type: 'add', newLineNumber: 2, content: 'added' },
    ]);

    // When
    const result = buildMarkdownPreviewRows([newBlock], [oldBlock], [hunk]);

    // Then
    expect(result).toEqual([{ kind: 'new', block: newBlock }]);
  });

  it('rejects an affected old block that is not classified as changed', () => {
    // Given
    const oldBlock = createClassifiedBlock(1, 1, 'unchanged');
    const hunk = createPreviewHunk('hunk-1', 1, 1, [
      { id: 'line-1', type: 'delete', oldLineNumber: 1, content: 'removed' },
    ]);

    // When / Then
    expect(() => buildMarkdownPreviewRows([], [oldBlock], [hunk])).toThrow(
      'is affected by a deletion but is not classified as changed',
    );
  });

  it('rejects a changed old block that is not affected by the supplied hunks', () => {
    // Given
    const oldBlock = createClassifiedBlock(1, 1);

    // When / Then
    expect(() => buildMarkdownPreviewRows([], [oldBlock], [])).toThrow(
      'is classified as changed but no deletion in the supplied hunks affects it',
    );
  });

  it('appends a removal whose boundary is after the final new block', () => {
    // Given
    const oldBlock = createClassifiedBlock(4, 4);
    const newBlock = createClassifiedBlock(1, 3, 'unchanged');
    const hunk = createPreviewHunk('hunk-1', 1, 1, [
      { id: 'line-1', type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'a' },
      { id: 'line-2', type: 'context', oldLineNumber: 2, newLineNumber: 2, content: 'b' },
      { id: 'line-3', type: 'context', oldLineNumber: 3, newLineNumber: 3, content: 'c' },
      { id: 'line-4', type: 'delete', oldLineNumber: 4, content: 'removed' },
    ]);

    // When
    const result = buildMarkdownPreviewRows([newBlock], [oldBlock], [hunk]);

    // Then
    expect(result).toEqual([
      { kind: 'new', block: newBlock },
      { kind: 'removed', block: oldBlock },
    ]);
  });

  it('returns only removed blocks when the new document has no blocks', () => {
    // Given
    const oldBlock = createClassifiedBlock(1, 1);
    const hunk = createPreviewHunk('hunk-1', 1, 0, [
      { id: 'line-1', type: 'delete', oldLineNumber: 1, content: 'removed' },
    ]);

    // When
    const result = buildMarkdownPreviewRows([], [oldBlock], [hunk]);

    // Then
    expect(result).toEqual([{ kind: 'removed', block: oldBlock }]);
  });

  it('does not mutate the input arrays or blocks', () => {
    // Given
    const oldBlock = createClassifiedBlock(1, 1);
    const newBlock = createClassifiedBlock(1, 1);
    const oldBlocks = [oldBlock];
    const newBlocks = [newBlock];
    const hunk = createPreviewHunk('hunk-1', 1, 1, [
      { id: 'line-1', type: 'delete', oldLineNumber: 1, content: 'old' },
      { id: 'line-2', type: 'add', newLineNumber: 1, content: 'new' },
    ]);

    // When
    const result = buildMarkdownPreviewRows(newBlocks, oldBlocks, [hunk]);

    // Then
    expect(oldBlocks).toEqual([oldBlock]);
    expect(newBlocks).toEqual([newBlock]);
    expect(result[0].block).toBe(oldBlock);
    expect(result[1].block).toBe(newBlock);
  });

  it('rejects unordered old or new block ranges', () => {
    // Given
    const unorderedBlocks = [createClassifiedBlock(3, 3), createClassifiedBlock(1, 1)];

    // When / Then
    expect(() => buildMarkdownPreviewRows([], unorderedBlocks, [])).toThrow(
      'blocks must be ordered and non-overlapping',
    );
    expect(() => buildMarkdownPreviewRows(unorderedBlocks, [], [])).toThrow(
      'blocks must be ordered and non-overlapping',
    );
  });

  it('rejects hunks that are not in document order', () => {
    // Given
    const hunks = [createPreviewHunk('hunk-2', 3, 3, []), createPreviewHunk('hunk-1', 1, 1, [])];

    // When / Then
    expect(() => buildMarkdownPreviewRows([], [], hunks)).toThrow(
      'Diff hunk "hunk-1" is out of document order after hunk "hunk-2".',
    );
  });

  it('rejects removal placements that move backwards despite ordered hunk starts', () => {
    // Given: overlapping new-side hunk ranges make the second insertion boundary move backwards
    const oldBlocks = [createClassifiedBlock(11, 11), createClassifiedBlock(12, 12)];
    const firstHunkContext = Array.from({ length: 10 }, (_, index): DiffLine => ({
      id: `context-${index + 1}`,
      type: 'context',
      oldLineNumber: index + 1,
      newLineNumber: index + 1,
      content: `line ${index + 1}`,
    }));
    const hunks = [
      createPreviewHunk('hunk-1', 1, 1, [
        ...firstHunkContext,
        { id: 'line-11', type: 'delete', oldLineNumber: 11, content: 'first' },
      ]),
      createPreviewHunk('hunk-2', 12, 5, [
        { id: 'line-12', type: 'delete', oldLineNumber: 12, content: 'second' },
      ]),
    ];

    // When / Then
    expect(() => buildMarkdownPreviewRows([], oldBlocks, hunks)).toThrow(
      'Removed Markdown blocks are not ordered by their new-side insertion point.',
    );
  });
});
