import { describe, expect, it } from 'vitest';
import type { DiffHunk, DiffLine } from './types';
import { classifyMarkdownBlocks, type MarkdownBlock } from './markdown-blocks';

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

  it('ignores context, opposite-side changes, and missing line numbers', () => {
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
        { id: 'line-3', type: 'add', content: 'missing number' },
      ]),
    ];

    // When
    const result = classifyMarkdownBlocks(blocks, hunks, 'new');

    // Then
    expect(result[0].status).toBe('unchanged');
  });

  it('combines and deduplicates changed lines from multiple hunks', () => {
    // Given
    const blocks = [createBlock(1, 1), createBlock(3, 3)];
    const hunks = [
      createHunk([{ id: 'line-1', type: 'add', newLineNumber: 1, content: 'first' }]),
      createHunk([
        { id: 'line-2', type: 'add', newLineNumber: 1, content: 'duplicate' },
        { id: 'line-3', type: 'add', newLineNumber: 3, content: 'second' },
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
