import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile, DiffHunk } from '../../../domain/diff/types';
import type { LineNote } from '../../../domain/notes/types';
import { MarkdownPreviewViewer, type MarkdownPreviewNoteSupport } from './MarkdownPreviewViewer';

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

function createLineNote(overrides: Partial<LineNote> = {}): LineNote {
  return {
    id: 'note-1',
    kind: 'line',
    path: 'README.md',
    startLine: 1,
    endLine: 1,
    bucket: 'staged',
    body: 'note body',
    createdAt: 1,
    staleness: { kind: 'live' },
    ...overrides,
  };
}

function createContextHunk(id: string, startLine: number, lineCount: number): DiffHunk {
  return {
    id,
    header: `@@ -${startLine},${lineCount} +${startLine},${lineCount} @@`,
    oldStart: startLine,
    oldLines: lineCount,
    newStart: startLine,
    newLines: lineCount,
    lines: Array.from({ length: lineCount }, (_, index) => ({
      id: `${id}-line-${startLine + index}`,
      type: 'context' as const,
      oldLineNumber: startLine + index,
      newLineNumber: startLine + index,
      content: `line ${startLine + index}`,
    })),
  };
}

function createNoteSupport(
  overrides: Partial<MarkdownPreviewNoteSupport> = {},
): MarkdownPreviewNoteSupport {
  return {
    path: 'README.md',
    bucket: 'staged',
    lineNotes: [],
    onAddNote: vi.fn(async () => {}),
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

  it('adds a note for the clamped new-side block range', async () => {
    // Given
    const user = userEvent.setup();
    const onAddNote = vi.fn(async () => {});
    const onCreateEditorOpenChange = vi.fn();
    render(
      <MarkdownPreviewViewer
        hunks={createFile().hunks}
        oldLines={['# Old', '', 'Same']}
        newLines={['# New', '', 'Same']}
        noteSupport={createNoteSupport({ onAddNote, onCreateEditorOpenChange })}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Add note for Line 1' }));
    await user.type(screen.getByRole('textbox'), 'preview note');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(onAddNote).toHaveBeenCalledWith(
      {
        kind: 'line',
        path: 'README.md',
        startLine: 1,
        endLine: 1,
        bucket: 'staged',
      },
      'preview note',
    );
    expect(onCreateEditorOpenChange).toHaveBeenNthCalledWith(1, true);
    expect(onCreateEditorOpenChange).toHaveBeenNthCalledWith(2, false);
  });

  it('keeps the editor draft when note creation fails', async () => {
    // Given
    const user = userEvent.setup();
    const onAddNote = vi.fn().mockRejectedValue(new Error('Unable to create note.'));
    render(
      <MarkdownPreviewViewer
        hunks={createFile().hunks}
        oldLines={['# Old', '', 'Same']}
        newLines={['# New', '', 'Same']}
        noteSupport={createNoteSupport({ onAddNote })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Add note for Line 1' }));
    await user.type(screen.getByRole('textbox'), 'preserved draft');

    // When
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then
    expect((await screen.findByRole('alert')).textContent).toBe('Unable to create note.');
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('preserved draft');
  });

  it('only offers note actions for new blocks overlapping a hunk', () => {
    // Given / When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={createFile().hunks}
        oldLines={['# Old', '', 'Same', '', 'Outside']}
        newLines={['# New', '', 'Same', '', 'Outside']}
        noteSupport={createNoteSupport()}
      />,
    );

    // Then
    const removedBlock = container.querySelector<HTMLElement>('[data-preview-kind="removed"]');
    const outsideBlock = screen
      .getByText('Outside')
      .closest<HTMLElement>('.markdown-preview-block');
    expect(removedBlock).not.toBeNull();
    expect(within(removedBlock!).queryByRole('button')).toBeNull();
    expect(outsideBlock).not.toBeNull();
    expect(
      within(outsideBlock!.parentElement!).queryByRole('button', { name: /Add note/ }),
    ).toBeNull();
  });

  it('offers one note action per hunk when one block spans multiple hunks', () => {
    // Given: a fenced code block remains one top-level Markdown block across both hunks
    const lines = ['```text', 'one', 'two', 'three', 'four', 'five', '```'];
    const hunks = [createContextHunk('hunk-1', 1, 2), createContextHunk('hunk-2', 5, 2)];

    // When
    render(
      <MarkdownPreviewViewer
        hunks={hunks}
        oldLines={lines}
        newLines={lines}
        noteSupport={createNoteSupport()}
      />,
    );

    // Then
    expect(screen.getByRole('button', { name: 'Add note for Lines 1–2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add note for Lines 5–6' })).toBeDefined();
  });

  it('highlights only new blocks overlapping an existing line note', () => {
    // Given / When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={createFile().hunks}
        oldLines={['# Old', '', 'Same']}
        newLines={['# New', '', 'Same']}
        noteSupport={createNoteSupport({
          lineNotes: [createLineNote({ startLine: 1, endLine: 2 })],
        })}
      />,
    );

    // Then
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('.markdown-preview-block'));
    expect(blocks.map((block) => block.dataset.noteHighlighted)).toEqual([
      undefined,
      'true',
      undefined,
    ]);
  });

  it('renders a note once, under the block holding its last line', () => {
    // Given: the note range covers both the heading (line 1) and the paragraph (line 3)
    const lineNotes = [createLineNote({ startLine: 1, endLine: 3, body: 'spanning note' })];

    // When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={createFile().hunks}
        oldLines={['# Old', '', 'Same']}
        newLines={['# New', '', 'Same']}
        noteSupport={createNoteSupport({ lineNotes })}
      />,
    );

    // Then: both blocks are highlighted, but only the block covering `endLine`
    // carries the card, matching where the Source view renders it.
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('.markdown-preview-block'));
    expect(blocks.map((block) => block.dataset.noteHighlighted)).toEqual([
      undefined,
      'true',
      'true',
    ]);
    expect(screen.getAllByText('spanning note')).toHaveLength(1);
    expect(within(blocks[2]).getByText('spanning note')).toBeDefined();
    // The block is coarser than the note, so the card states its own range.
    expect(within(blocks[2]).getByText('Lines 1–3')).toBeDefined();
  });

  it('updates and deletes an existing note from the preview', async () => {
    // Given
    const user = userEvent.setup();
    const onUpdateNote = vi.fn(async () => {});
    const onDeleteNote = vi.fn(async () => {});
    render(
      <MarkdownPreviewViewer
        hunks={createFile().hunks}
        oldLines={['# Old', '', 'Same']}
        newLines={['# New', '', 'Same']}
        noteSupport={createNoteSupport({
          lineNotes: [createLineNote({ startLine: 1, endLine: 1 })],
          onUpdateNote,
          onDeleteNote,
        })}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'edited body');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(onUpdateNote).toHaveBeenCalledWith('note-1', 'edited body');

    // When
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Then
    expect(onDeleteNote).toHaveBeenCalledWith('note-1');
  });

  it('reports an open note card editor to its container', async () => {
    // Given
    const user = userEvent.setup();
    const onNoteEditorOpenChange = vi.fn();
    const { unmount } = render(
      <MarkdownPreviewViewer
        hunks={createFile().hunks}
        oldLines={['# Old', '', 'Same']}
        newLines={['# New', '', 'Same']}
        noteSupport={createNoteSupport({
          lineNotes: [createLineNote({ startLine: 1, endLine: 1 })],
          onNoteEditorOpenChange,
        })}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Then
    expect(onNoteEditorOpenChange).toHaveBeenLastCalledWith('note-1', true);

    // When: an unmount has to release the protection the open editor asked for
    unmount();

    // Then
    expect(onNoteEditorOpenChange).toHaveBeenLastCalledWith('note-1', false);
  });

  it('still shows notes when the new document renders no block', () => {
    // Given: a line note created from the Source view survives the file losing
    // every Markdown block, so the preview must not drop it.
    const lineNotes = [createLineNote({ startLine: 1, endLine: 1, body: 'orphaned note' })];

    // When
    const { container } = render(
      <MarkdownPreviewViewer
        hunks={[]}
        oldLines={[]}
        newLines={[]}
        noteSupport={createNoteSupport({ lineNotes })}
      />,
    );

    // Then
    expect(container.querySelectorAll('.markdown-preview-block')).toHaveLength(0);
    expect(
      within(container.querySelector<HTMLElement>('.markdown-preview-unanchored-notes')!).getByText(
        'orphaned note',
      ),
    ).toBeDefined();
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
