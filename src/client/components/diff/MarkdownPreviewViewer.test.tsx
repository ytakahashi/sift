import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import { MarkdownPreviewViewer } from './MarkdownPreviewViewer';

function createFile(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    id: 'file-README.md',
    bucket: 'staged',
    path: 'README.md',
    status: 'modified',
    kind: 'text',
    displayPath: 'README.md',
    oldBlobId: 'old-blob',
    newBlobId: 'new-blob',
    hunks: [
      {
        id: 'hunk-1',
        header: '@@ -1,3 +1,3 @@',
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 3,
        lines: [
          { id: 'line-old-1', type: 'delete', oldLineNumber: 1, content: '# Old' },
          { id: 'line-new-1', type: 'add', newLineNumber: 1, content: '# New' },
          {
            id: 'line-2',
            type: 'context',
            oldLineNumber: 2,
            newLineNumber: 2,
            content: '',
          },
          {
            id: 'line-3',
            type: 'context',
            oldLineNumber: 3,
            newLineNumber: 3,
            content: 'Same',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('MarkdownPreviewViewer', () => {
  afterEach(cleanup);

  it('renders removed, changed, and unchanged blocks in preview order', () => {
    // Given / When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={createFile().hunks}
        oldLines={['# Old', '', 'Same']}
        newLines={['# New', '', 'Same']}
      />,
    );

    // Then
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('.markdown-preview-block'));
    expect(blocks.map((block) => block.dataset.previewKind)).toEqual(['removed', 'new', 'new']);
    expect(blocks.map((block) => block.dataset.previewStatus)).toEqual([
      'changed',
      'changed',
      'unchanged',
    ]);
    expect(blocks.map((block) => block.textContent)).toEqual(['Old', 'New', 'Same']);
    expect(screen.getByRole('heading', { name: 'Old' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'New' })).toBeDefined();
  });

  it('renders common Markdown structures as React elements', () => {
    // Given
    const lines = [
      '## Heading',
      '',
      'A **strong** paragraph with `code`.',
      '',
      '- first',
      '- second',
      '',
      '> quoted',
      '',
      '```ts',
      'const value = 1;',
      '```',
      '',
      '---',
    ];

    // When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={createFile({ hunks: [] }).hunks}
        oldLines={lines}
        newLines={lines}
      />,
    );

    // Then
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeDefined();
    expect(container.querySelector('strong')?.textContent).toBe('strong');
    expect(container.querySelector('p code')?.textContent).toBe('code');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('blockquote')?.textContent).toContain('quoted');
    expect(container.querySelector('pre code')?.textContent).toContain('const value = 1;');
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('does not interpret raw HTML or retain dangerous Markdown URLs', () => {
    // Given
    const lines = ['<img src="missing" onerror="alert(1)">', '', '[unsafe](javascript:alert(1))'];

    // When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={createFile({ hunks: [] }).hunks}
        oldLines={lines}
        newLines={lines}
      />,
    );

    // Then
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onerror]')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByText('unsafe').getAttribute('title')).toBeNull();
  });

  it('renders Markdown links without allowing navigation', () => {
    // Given
    const lines = ['[External](https://example.com)', '', '[Relative](./docs/guide.md)'];

    // When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={createFile({ hunks: [] }).hunks}
        oldLines={lines}
        newLines={lines}
      />,
    );

    // Then
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByText('External').getAttribute('title')).toBe('https://example.com');
    expect(screen.getByText('Relative').getAttribute('title')).toBe('./docs/guide.md');
  });

  it('renders Markdown images as non-loading placeholders', () => {
    // Given
    const lines = ['![diagram](https://example.com/diagram.png)'];

    // When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={createFile({ hunks: [] }).hunks}
        oldLines={lines}
        newLines={lines}
      />,
    );

    // Then
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: 'Image: diagram' }).textContent).toBe(
      '[Image: diagram]',
    );
  });

  it('leaves references unresolved when their definitions are in another block', () => {
    // Given
    const lines = ['[Example][target]', '', '[target]: https://example.com'];

    // When
    render(
      <MarkdownPreviewViewer
        hunks={createFile({ hunks: [] }).hunks}
        oldLines={lines}
        newLines={lines}
      />,
    );

    // Then
    expect(screen.queryByRole('link', { name: 'Example' })).toBeNull();
    expect(screen.getByText('[Example][target]')).toBeDefined();
  });

  it('contains invalid diff data as an inline error and resets for new preview data', () => {
    // Given
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const file = createFile();
    const invalidHunks = [
      {
        ...file.hunks[0],
        lines: [{ id: 'invalid-add', type: 'add' as const, content: '# New' }],
      },
    ];

    // When
    const { rerender } = render(
      <MarkdownPreviewViewer hunks={invalidHunks} oldLines={['# Old']} newLines={['# New']} />,
    );

    // Then
    expect(screen.getByRole('alert').textContent).toBe(
      'Unable to render the Markdown preview. Switch to Source and try again.',
    );

    // When
    rerender(
      <MarkdownPreviewViewer
        hunks={createFile({ hunks: [] }).hunks}
        oldLines={['# Recovered']}
        newLines={['# Recovered']}
      />,
    );

    // Then
    expect(screen.getByRole('heading', { name: 'Recovered' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
    consoleError.mockRestore();
  });
});
