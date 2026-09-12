import { describe, expect, it } from 'vitest';
import { parseDiff } from '../../../domain/diff/diff-parser';
import { isFileLinesConsistentWithHunks } from '../../../domain/diff/file-content-consistency';
import { splitTextFileLines } from '../../../domain/diff/text-file-lines';
import {
  classifyMarkdownBlocks,
  clampBlockRangeToHunks,
  type ClassifiedMarkdownBlock,
} from '../../../domain/diff/markdown-blocks';
import {
  resolveLineNoteTarget,
  type LineNoteTargetResolution,
} from '../../../domain/notes/resolve-line-note-target';
import { parseMarkdownBlocks } from './markdown-block-parser';

/**
 * The preview offers a note affordance for every range `clampBlockRangeToHunks`
 * returns, and note creation then resolves that range through
 * `resolveLineNoteTarget`. Both derive hunk coverage independently, so this
 * suite runs one real `git diff` output through the whole chain to keep the two
 * from drifting: an offered range that the resolver rejects would fail at the
 * moment the user clicks "+".
 *
 * The document and the diff below are a matching pair captured from Git; the
 * first test guards that pairing so the rest cannot silently test a mismatch.
 */
const NEW_DOCUMENT = `# Release notes 2.0

Rewritten intro paragraph describing the release.

## Highlights

- first highlight
- second highlight
- third highlight

Long paragraph that starts inside the first hunk
and continues past its last context line
so the block is only partly covered.

Filler paragraph two.

Filler paragraph three.

\`\`\`text
code line one
code line two changed
\`\`\`

Filler paragraph four.

Filler paragraph five.
`;

/**
 * Git writes an unchanged blank line as a single space, and `parseDiff` reads
 * that leading character to type the line. Source files here must not carry
 * trailing whitespace, so those lines are stored empty and the marker is
 * restored on load; a restoration that stops matching the document fails the
 * pairing test below.
 */
const RAW_DIFF = `diff --git a/doc.md b/doc.md
index 870e05ce46f45c48765feb458f771f805011fa49..8486c1fca659212e65b0b6b5b3dcea9a0bcb6869 100644
--- a/doc.md
+++ b/doc.md
@@ -1,11 +1,12 @@
-# Release notes
+# Release notes 2.0

-Intro paragraph describing the release.
+Rewritten intro paragraph describing the release.

 ## Highlights

 - first highlight
 - second highlight
+- third highlight

 Long paragraph that starts inside the first hunk
 and continues past its last context line
@@ -17,11 +18,9 @@ Filler paragraph three.

 \`\`\`text
 code line one
-code line two
+code line two changed
 \`\`\`

 Filler paragraph four.

 Filler paragraph five.
-
-Closing paragraph that goes away.`
  .split('\n')
  .map((line) => (line === '' ? ' ' : line))
  .join('\n');

const NEW_LINES = splitTextFileLines(NEW_DOCUMENT);
const [FILE] = parseDiff(RAW_DIFF, 'staged');
const BLOCKS = classifyMarkdownBlocks(parseMarkdownBlocks(NEW_DOCUMENT), FILE.hunks, 'new');

function resolve(startLine: number, endLine: number): LineNoteTargetResolution {
  return resolveLineNoteTarget({
    workingFiles: [],
    stagedFiles: [FILE],
    path: FILE.path,
    startLine,
    endLine,
    bucketConstraint: { kind: 'only', bucket: 'staged' },
  });
}

function describeBlock(block: ClassifiedMarkdownBlock): string {
  return `${block.id} (lines ${block.startLine}-${block.endLine})`;
}

describe('Markdown preview note targets', () => {
  it('pairs the captured document with the captured diff', () => {
    // Given / When / Then: every new-side line the diff carries must match the
    // document, or the rest of this suite would prove nothing.
    expect(isFileLinesConsistentWithHunks(FILE.hunks, NEW_LINES)).toBe(true);
    expect(FILE.hunks).toHaveLength(2);
  });

  it('offers a range for the blocks a hunk covers, including a partial overlap', () => {
    // Given / When
    const offers = BLOCKS.map((block) => ({
      block: describeBlock(block),
      ranges: clampBlockRangeToHunks(block, FILE.hunks),
    }));

    // Then: the long paragraph spans lines 11-13 while the first hunk stops at
    // line 12, so only its covered part is offered.
    expect(offers.find(({ block }) => block.includes('11-13'))?.ranges).toEqual([
      { startLine: 11, endLine: 12, hunkId: FILE.hunks[0].id },
    ]);
    // Paragraphs between the two hunks carry no affordance at all.
    expect(offers.find(({ block }) => block.includes('15-15'))?.ranges).toEqual([]);
    expect(offers.find(({ block }) => block.includes('17-17'))?.ranges).toEqual([]);
  });

  it('resolves every offered range to the hunk it was clamped to', () => {
    // Given
    const offeredRanges = BLOCKS.flatMap((block) =>
      clampBlockRangeToHunks(block, FILE.hunks).map((range) => ({
        block: describeBlock(block),
        range,
      })),
    );

    // When
    const resolved = offeredRanges.map(({ block, range }) => {
      const resolution = resolve(range.startLine, range.endLine);
      return {
        block,
        lines: `${range.startLine}-${range.endLine}`,
        hunkId: resolution.kind === 'resolved' ? resolution.target.hunkId : resolution.kind,
      };
    });

    // Then: an offered range the resolver rejects is a bug the user only
    // discovers after clicking "+". Five blocks sit in the first hunk and
    // three in the second.
    expect(offeredRanges).toHaveLength(8);
    expect(resolved).toEqual(
      offeredRanges.map(({ block, range }) => ({
        block,
        lines: `${range.startLine}-${range.endLine}`,
        hunkId: range.hunkId,
      })),
    );
  });

  it('records the offered range contents as the note anchor', () => {
    // Given: the code fence block sits entirely inside the second hunk
    const codeBlock = BLOCKS.find((block) => block.raw.startsWith('```text'));
    const [range] = clampBlockRangeToHunks(codeBlock!, FILE.hunks);

    // When
    const resolution = resolve(range.startLine, range.endLine);

    // Then: the anchor baseline comes from the same lines the preview rendered
    expect(resolution.kind === 'resolved' && resolution.target.lineContents).toEqual(
      NEW_LINES.slice(range.startLine - 1, range.endLine),
    );
  });

  it('cannot anchor a note on a block no hunk covers', () => {
    // Given
    const uncoveredBlocks = BLOCKS.filter(
      (block) => clampBlockRangeToHunks(block, FILE.hunks).length === 0,
    );

    // When / Then: the preview hides the affordance for exactly the ranges the
    // resolver refuses, so the two rules stay in step.
    expect(uncoveredBlocks).toHaveLength(2);
    expect(uncoveredBlocks.map((block) => resolve(block.startLine, block.endLine).kind)).toEqual(
      uncoveredBlocks.map(() => 'not-found'),
    );
  });
});
