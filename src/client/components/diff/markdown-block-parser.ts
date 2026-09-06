import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { MarkdownBlock } from '../../../domain/diff/markdown-blocks';

// This frozen shared instance handles parse-only calls. Consumers that add
// transformation plugins must use createMarkdownProcessor to get a mutable clone.
const frozenMarkdownProcessor = unified().use(remarkParse).freeze();

/**
 * Creates the shared Markdown syntax pipeline for both block extraction and
 * per-block rendering. Add syntax plugins here so their AST boundaries cannot diverge.
 */
export function createMarkdownProcessor(): typeof frozenMarkdownProcessor {
  return frozenMarkdownProcessor();
}

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const root = frozenMarkdownProcessor.parse(text);

  return root.children.map((node) => {
    const position = node.position;
    // Source positions are required for both diff classification and future
    // line-note anchors, so omitting an unanchored block would be unsafe.
    if (position?.start.offset === undefined || position.end.offset === undefined) {
      throw new Error('Markdown parser returned a block without a source position.');
    }

    const startLine = position.start.line;
    const endLine = position.end.line;
    return {
      id: `${node.type}-${startLine}-${endLine}`,
      startLine,
      endLine,
      // Rendering this slice in isolation intentionally cannot resolve
      // document-wide definitions or footnotes outside the block.
      raw: text.slice(position.start.offset, position.end.offset),
    };
  });
}
