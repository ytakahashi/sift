import { describe, expect, it } from 'vitest';
import { createMarkdownProcessor, parseMarkdownBlocks } from './markdown-block-parser';

describe('parseMarkdownBlocks', () => {
  it.each(['', ' \n\t\n'])('returns no blocks for content without markdown nodes', (text) => {
    // Given / When
    const blocks = parseMarkdownBlocks(text);

    // Then
    expect(blocks).toEqual([]);
  });

  it('extracts top-level blocks with inclusive source line ranges', () => {
    // Given
    const text = [
      '# Heading',
      '',
      'First paragraph',
      'continues here.',
      '',
      '- first',
      '  - nested',
      '- second',
      '',
      '> quote',
      '',
      '---',
    ].join('\n');

    // When
    const blocks = parseMarkdownBlocks(text);

    // Then
    expect(blocks).toEqual([
      { id: 'heading-1-1', startLine: 1, endLine: 1, raw: '# Heading' },
      {
        id: 'paragraph-3-4',
        startLine: 3,
        endLine: 4,
        raw: 'First paragraph\ncontinues here.',
      },
      {
        id: 'list-6-8',
        startLine: 6,
        endLine: 8,
        raw: '- first\n  - nested\n- second',
      },
      { id: 'blockquote-10-10', startLine: 10, endLine: 10, raw: '> quote' },
      { id: 'thematicBreak-12-12', startLine: 12, endLine: 12, raw: '---' },
    ]);
  });

  it('treats a setext heading and fenced code as complete top-level blocks', () => {
    // Given
    const text = ['Heading', '=======', '', '```ts', 'const value = 1;', '```'].join('\n');

    // When
    const blocks = parseMarkdownBlocks(text);

    // Then
    expect(blocks).toEqual([
      { id: 'heading-1-2', startLine: 1, endLine: 2, raw: 'Heading\n=======' },
      {
        id: 'code-4-6',
        startLine: 4,
        endLine: 6,
        raw: '```ts\nconst value = 1;\n```',
      },
    ]);
  });

  it('uses source offsets to preserve CRLF inside raw blocks', () => {
    // Given
    const text = 'first line\r\nsecond line\r\n\r\n# Heading\r\n';

    // When
    const blocks = parseMarkdownBlocks(text);

    // Then
    expect(blocks[0]).toMatchObject({
      startLine: 1,
      endLine: 2,
      raw: 'first line\r\nsecond line',
    });
    expect(blocks[1]).toMatchObject({ startLine: 4, endLine: 4, raw: '# Heading' });
  });

  it('produces deterministic ids for the same source', () => {
    // Given
    const text = '# Heading\n\nParagraph';

    // When
    const first = parseMarkdownBlocks(text);
    const second = parseMarkdownBlocks(text);

    // Then
    expect(first.map((block) => block.id)).toEqual(second.map((block) => block.id));
  });
});

describe('createMarkdownProcessor', () => {
  it('returns a fresh processor clone for each plugin pipeline', () => {
    // Given / When
    const first = createMarkdownProcessor();
    const second = createMarkdownProcessor();

    // Then
    expect(first).not.toBe(second);
  });
});
