import type { DiffHunk, DiffLine } from './types';

type NumberedDiffLine =
  | (DiffLine & { type: 'add'; newLineNumber: number })
  | (DiffLine & { type: 'delete'; oldLineNumber: number })
  | (DiffLine & { type: 'context'; oldLineNumber: number; newLineNumber: number });

type NumberedDiffHunk = DiffHunk & { lines: NumberedDiffLine[] };

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

export type MarkdownPreviewRow =
  | { kind: 'new'; block: ClassifiedMarkdownBlock }
  | { kind: 'removed'; block: ClassifiedMarkdownBlock };

export function classifyMarkdownBlocks(
  blocks: MarkdownBlock[],
  hunks: DiffHunk[],
  side: 'old' | 'new',
): ClassifiedMarkdownBlock[] {
  assertOrderedNonOverlappingBlocks(blocks);
  assertRequiredDiffLineNumbers(hunks);

  const changedBlockIndexes = new Set<number>();
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      const isNewSideChange = side === 'new' && line.type === 'add';
      const isOldSideChange = side === 'old' && line.type === 'delete';
      if (!isNewSideChange && !isOldSideChange) {
        continue;
      }

      const lineNumber = line.type === 'add' ? line.newLineNumber : line.oldLineNumber;
      for (const blockIndex of findAffectedBlockIndexes(
        blocks,
        lineNumber,
        line.content.trim() === '',
      )) {
        changedBlockIndexes.add(blockIndex);
      }
    }
  }

  return blocks.map((block, index) => {
    return {
      ...block,
      status: changedBlockIndexes.has(index) ? 'changed' : 'unchanged',
    };
  });
}

/**
 * Builds rows from blocks classified against the same hunks supplied here.
 * Mixing classifications from another diff would make removed-block status
 * inconsistent with the deletion events used to place those blocks.
 */
export function buildMarkdownPreviewRows(
  newBlocks: ClassifiedMarkdownBlock[],
  oldBlocks: ClassifiedMarkdownBlock[],
  hunks: DiffHunk[],
): MarkdownPreviewRow[] {
  assertOrderedNonOverlappingBlocks(newBlocks);
  assertOrderedNonOverlappingBlocks(oldBlocks);
  assertRequiredDiffLineNumbers(hunks);
  assertOrderedHunks(hunks);

  const removedBlocks: Array<{
    insertionLine: number;
    oldBlockIndex: number;
    block: ClassifiedMarkdownBlock;
  }> = [];
  const assignedOldBlockIndexes = new Set<number>();

  // Diff hunks and their lines arrive in document order. A deletion consumes
  // no new-side line, so the current cursor is its precise insertion boundary.
  for (const hunk of hunks) {
    let newLineCursor = hunk.newStart;

    for (const line of hunk.lines) {
      if (line.type === 'delete') {
        for (const blockIndex of findAffectedBlockIndexes(
          oldBlocks,
          line.oldLineNumber,
          line.content.trim() === '',
        )) {
          if (assignedOldBlockIndexes.has(blockIndex)) {
            continue;
          }
          if (oldBlocks[blockIndex].status !== 'changed') {
            throw new Error(
              `Old Markdown block "${oldBlocks[blockIndex].id}" is affected by a deletion but is not classified as changed; blocks must be classified with the same hunks used to build preview rows.`,
            );
          }

          assignedOldBlockIndexes.add(blockIndex);
          removedBlocks.push({
            insertionLine: newLineCursor,
            oldBlockIndex: blockIndex,
            block: oldBlocks[blockIndex],
          });
        }
        continue;
      }

      newLineCursor = line.newLineNumber + 1;
    }
  }

  for (let blockIndex = 0; blockIndex < oldBlocks.length; blockIndex++) {
    if (oldBlocks[blockIndex].status === 'changed' && !assignedOldBlockIndexes.has(blockIndex)) {
      throw new Error(
        `Old Markdown block "${oldBlocks[blockIndex].id}" is classified as changed but no deletion in the supplied hunks affects it.`,
      );
    }
  }
  assertOrderedRemovalPlacements(removedBlocks);

  const rows: MarkdownPreviewRow[] = [];
  let removedBlockIndex = 0;

  for (const block of newBlocks) {
    // A deletion inside a top-level Markdown node belongs before that whole
    // node because preview rows never split a node into smaller render units.
    while (
      removedBlockIndex < removedBlocks.length &&
      removedBlocks[removedBlockIndex].insertionLine <= block.endLine
    ) {
      rows.push({ kind: 'removed', block: removedBlocks[removedBlockIndex].block });
      removedBlockIndex++;
    }
    rows.push({ kind: 'new', block });
  }

  while (removedBlockIndex < removedBlocks.length) {
    rows.push({ kind: 'removed', block: removedBlocks[removedBlockIndex].block });
    removedBlockIndex++;
  }

  return rows;
}

function findAffectedBlockIndexes(
  blocks: MarkdownBlock[],
  lineNumber: number,
  whitespace: boolean,
): number[] {
  let low = 0;
  let high = blocks.length;

  // Locate the first block ending at or after the changed source line.
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (blocks[middle].endLine < lineNumber) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const nextBlockIndex = low;
  const nextBlock = blocks[nextBlockIndex];
  if (nextBlock !== undefined && nextBlock.startLine <= lineNumber) {
    return [nextBlockIndex];
  }
  if (!whitespace) {
    return [];
  }

  // Markdown AST nodes exclude separating blank lines. Assign a changed gap
  // to both neighbors, or to the nearest block at a document boundary.
  const affectedIndexes: number[] = [];
  if (nextBlockIndex > 0) {
    affectedIndexes.push(nextBlockIndex - 1);
  }
  if (nextBlockIndex < blocks.length) {
    affectedIndexes.push(nextBlockIndex);
  }
  return affectedIndexes;
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

function assertRequiredDiffLineNumbers(hunks: DiffHunk[]): asserts hunks is NumberedDiffHunk[] {
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      const missingOldLineNumber =
        (line.type === 'context' || line.type === 'delete') && line.oldLineNumber === undefined;
      const missingNewLineNumber =
        (line.type === 'context' || line.type === 'add') && line.newLineNumber === undefined;
      if (missingOldLineNumber || missingNewLineNumber) {
        const missingFields = [
          missingOldLineNumber ? 'oldLineNumber' : undefined,
          missingNewLineNumber ? 'newLineNumber' : undefined,
        ].filter((field): field is string => field !== undefined);
        throw new Error(
          `Diff ${line.type} line "${line.id}" in hunk "${hunk.id}" is missing ${missingFields.join(' and ')}.`,
        );
      }
    }
  }
}

function assertOrderedHunks(hunks: DiffHunk[]): void {
  for (let index = 1; index < hunks.length; index++) {
    const previousHunk = hunks[index - 1];
    const hunk = hunks[index];
    if (hunk.oldStart < previousHunk.oldStart || hunk.newStart < previousHunk.newStart) {
      throw new Error(
        `Diff hunk "${hunk.id}" is out of document order after hunk "${previousHunk.id}".`,
      );
    }
  }
}

function assertOrderedRemovalPlacements(
  placements: Array<{ insertionLine: number; oldBlockIndex: number }>,
): void {
  for (let index = 1; index < placements.length; index++) {
    const previousPlacement = placements[index - 1];
    const placement = placements[index];
    if (
      placement.insertionLine < previousPlacement.insertionLine ||
      (placement.insertionLine === previousPlacement.insertionLine &&
        placement.oldBlockIndex < previousPlacement.oldBlockIndex)
    ) {
      throw new Error('Removed Markdown blocks are not ordered by their new-side insertion point.');
    }
  }
}
