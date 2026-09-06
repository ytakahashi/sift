import type { DiffHunk } from './types';

export interface MarkdownBlock {
  id: string;
  /** 1-based, inclusive source line. */
  startLine: number;
  /** 1-based, inclusive source line. */
  endLine: number;
  raw: string;
}

export type MarkdownBlockStatus = 'unchanged' | 'changed';

export interface ClassifiedMarkdownBlock extends MarkdownBlock {
  status: MarkdownBlockStatus;
}

export function classifyMarkdownBlocks(
  blocks: MarkdownBlock[],
  hunks: DiffHunk[],
  side: 'old' | 'new',
): ClassifiedMarkdownBlock[] {
  assertOrderedNonOverlappingBlocks(blocks);

  const { all: changedLines, whitespace: changedWhitespaceLines } = collectChangedLines(
    hunks,
    side,
  );
  const lastChangedWhitespaceLine = changedWhitespaceLines.at(-1) ?? 0;

  return blocks.map((block, index) => {
    // Markdown AST nodes exclude separating blank lines. Assign each gap to
    // both neighbors so whitespace-only structural edits remain visible.
    const leadingWhitespaceStart = index === 0 ? 1 : blocks[index - 1].endLine + 1;
    const nextBlock = blocks[index + 1];
    const trailingWhitespaceEnd = nextBlock
      ? nextBlock.startLine - 1
      : Math.max(block.endLine, lastChangedWhitespaceLine);
    const changed =
      hasLineInRange(changedLines, block.startLine, block.endLine) ||
      hasLineInRange(changedWhitespaceLines, leadingWhitespaceStart, block.startLine - 1) ||
      hasLineInRange(changedWhitespaceLines, block.endLine + 1, trailingWhitespaceEnd);

    return {
      ...block,
      status: changed ? 'changed' : 'unchanged',
    };
  });
}

function collectChangedLines(
  hunks: DiffHunk[],
  side: 'old' | 'new',
): { all: number[]; whitespace: number[] } {
  const all = new Set<number>();
  const whitespace = new Set<number>();

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      const lineNumber =
        side === 'new' && line.type === 'add'
          ? line.newLineNumber
          : side === 'old' && line.type === 'delete'
            ? line.oldLineNumber
            : undefined;
      if (lineNumber !== undefined) {
        all.add(lineNumber);
        if (line.content.trim() === '') {
          whitespace.add(lineNumber);
        }
      }
    }
  }

  return {
    all: Array.from(all).sort((left, right) => left - right),
    whitespace: Array.from(whitespace).sort((left, right) => left - right),
  };
}

function hasLineInRange(lines: number[], startLine: number, endLine: number): boolean {
  let low = 0;
  let high = lines.length;

  // Find the first sorted change at or after startLine; it overlaps only when
  // that lower bound is still within the inclusive endLine.
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle] < startLine) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low < lines.length && lines[low] <= endLine;
}

function assertOrderedNonOverlappingBlocks(blocks: MarkdownBlock[]): void {
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const previousBlock = blocks[index - 1];
    if (
      block.startLine < 1 ||
      block.endLine < block.startLine ||
      (previousBlock !== undefined && block.startLine <= previousBlock.endLine)
    ) {
      const previousContext = previousBlock
        ? ` Previous block "${previousBlock.id}" spans lines ${previousBlock.startLine}-${previousBlock.endLine}.`
        : '';
      throw new Error(
        `Markdown block at index ${index} ("${block.id}", lines ${block.startLine}-${block.endLine}) is invalid; blocks must be ordered and non-overlapping.${previousContext}`,
      );
    }
  }
}
