import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import type { FileNote, LineNote } from '../../../domain/notes/types';
import { BlobContentFetchError, FileContentFetchError } from '../../application/ports';
import { UnifiedDiffViewer } from './UnifiedDiffViewer';

const NULL_BLOB_ID = '0'.repeat(40);

const viewerDependencies = {
  blobContentReader: {
    fetchBlobContent: vi.fn(),
  },
  repoId: 'repo',
  fileContentReader: {
    fetchFileContent: vi.fn(),
  },
};

function createDiffToolbarTarget(): HTMLSpanElement {
  const target = document.createElement('span');
  target.dataset.diffToolbarTarget = 'true';
  document.body.append(target);
  return target;
}

function createTextFile(): DiffFile {
  return {
    id: 'file-1',
    bucket: 'working',
    path: 'src/file.ts',
    status: 'modified',
    kind: 'text',
    displayPath: 'src/file.ts',
    hunks: [
      {
        id: 'hunk-1',
        header: '@@ -1,1 +1,1 @@',
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 3,
        lines: [
          {
            id: 'line-1',
            type: 'context',
            oldLineNumber: 1,
            newLineNumber: 1,
            content: 'const a = 1;',
          },
          {
            id: 'line-2',
            type: 'context',
            oldLineNumber: 2,
            newLineNumber: 2,
            content: 'const b = 2;',
          },
          {
            id: 'line-3',
            type: 'context',
            oldLineNumber: 3,
            newLineNumber: 3,
            content: 'const c = 3;',
          },
        ],
      },
    ],
  };
}

function createCopyableDiffFile(): DiffFile {
  return {
    ...createTextFile(),
    hunks: [
      {
        id: 'hunk-1',
        header: '@@ -1,2 +1,2 @@',
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        lines: [
          {
            id: 'line-context',
            type: 'context',
            oldLineNumber: 1,
            newLineNumber: 1,
            content: '  const unchanged = true;',
          },
          {
            id: 'line-delete',
            type: 'delete',
            oldLineNumber: 2,
            content: 'const value = 1;',
          },
          {
            id: 'line-add',
            type: 'add',
            newLineNumber: 2,
            content: 'const value = 2;',
          },
        ],
      },
    ],
  };
}

function createExpandableFile(): DiffFile {
  return {
    ...createTextFile(),
    bucket: 'staged',
    newBlobId: 'expected-blob',
  };
}

function createMarkdownFile(overrides: Partial<DiffFile> = {}): DiffFile {
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
        header: '@@ -1,2 +1,2 @@',
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        lines: [
          { id: 'line-old-1', type: 'delete', oldLineNumber: 1, content: '# Old' },
          { id: 'line-new-1', type: 'add', newLineNumber: 1, content: '# New' },
          {
            id: 'line-2',
            type: 'context',
            oldLineNumber: 2,
            newLineNumber: 2,
            content: 'Same',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createAddedMarkdownFile(): DiffFile {
  return createMarkdownFile({
    status: 'added',
    // `git diff --full-index` emits the absent old side as a full zero object ID.
    oldBlobId: NULL_BLOB_ID,
    hunks: [
      {
        id: 'hunk-added',
        header: '@@ -0,0 +1,3 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 3,
        lines: [
          { id: 'line-1', type: 'add', newLineNumber: 1, content: '# New document' },
          { id: 'line-2', type: 'add', newLineNumber: 2, content: '' },
          { id: 'line-3', type: 'add', newLineNumber: 3, content: 'Body' },
        ],
      },
    ],
  });
}

function createTwoHunkFile(): DiffFile {
  const file = createTextFile();
  return {
    ...file,
    hunks: [
      {
        ...file.hunks[0],
        id: 'hunk-1',
        lines: file.hunks[0].lines.slice(0, 2),
      },
      {
        id: 'hunk-2',
        header: '@@ -5,2 +5,2 @@',
        oldStart: 5,
        oldLines: 2,
        newStart: 5,
        newLines: 2,
        lines: [
          {
            id: 'line-5',
            type: 'context',
            oldLineNumber: 5,
            newLineNumber: 5,
            content: 'const e = 5;',
          },
          {
            id: 'line-6',
            type: 'context',
            oldLineNumber: 6,
            newLineNumber: 6,
            content: 'const f = 6;',
          },
        ],
      },
    ],
  };
}

function createBinaryFile(): DiffFile {
  return {
    id: 'file-1',
    bucket: 'working',
    path: 'src/file.png',
    status: 'binary',
    kind: 'binary',
    displayPath: 'src/file.png',
    hunks: [],
  };
}

function createFileNote(overrides?: Partial<FileNote>): FileNote {
  return {
    id: 'file-note',
    kind: 'file',
    path: 'src/file.ts',
    body: 'file note body',
    createdAt: 1000,
    staleness: { kind: 'live' },
    ...overrides,
  };
}

function createLineNote(overrides?: Partial<LineNote>): LineNote {
  return {
    id: 'line-note',
    kind: 'line',
    path: 'src/file.ts',
    startLine: 1,
    endLine: 1,
    bucket: 'working',
    body: 'line note body',
    createdAt: 1000,
    staleness: { kind: 'live' },
    ...overrides,
  };
}

describe('UnifiedDiffViewer', () => {
  afterEach(() => {
    cleanup();
    document
      .querySelectorAll('[data-diff-toolbar-target="true"]')
      .forEach((target) => target.remove());
    vi.clearAllMocks();
  });

  it('keeps diff markers separate from source line content', () => {
    // Given: a diff containing context, deleted, and added source lines
    const file = createCopyableDiffFile();

    // When: the unified diff is rendered
    const { container } = render(
      <UnifiedDiffViewer {...viewerDependencies} file={file} paneMode="working" />,
    );

    // Then: every source row has one marker with the class that connects the
    // DOM structure to global.css's browser-compatible selection exclusion
    const markers = Array.from(container.querySelectorAll<HTMLElement>('.diff-line-marker'));
    expect(markers.map((marker) => marker.textContent)).toEqual([' ', '-', '+']);
    expect(markers.every((marker) => marker.classList.contains('diff-selection-decoration'))).toBe(
      true,
    );

    // The line-number and note-gutter cells share the same browser-compatible
    // selection exclusion as the markers, including on the hunk-header row.
    const rows = Array.from(container.querySelectorAll('tbody > tr'));
    expect(rows).toHaveLength(4);
    expect(
      rows.every((row) =>
        Array.from(row.children)
          .slice(0, 3)
          .every((cell) => cell.classList.contains('diff-selection-decoration')),
      ),
    ).toBe(true);

    // Removing the non-source marker must preserve the complete source text,
    // including indentation that belongs to a context line.
    const sourceContents = markers.map((marker) => {
      const codeCell = marker.closest('td');
      const copy = codeCell?.cloneNode(true) as HTMLTableCellElement | undefined;
      copy?.querySelector('.diff-line-marker')?.remove();
      return copy?.textContent;
    });
    expect(sourceContents).toEqual(file.hunks[0].lines.map((line) => line.content));
  });

  it('adds a file note from the top editor', async () => {
    // Given: the file note editor is open at the top of the diff
    const user = userEvent.setup();
    const onAddNote = vi.fn();
    const onCloseFileNoteEditor = vi.fn();
    render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createTextFile()}
        paneMode="working"
        onAddNote={onAddNote}
        isFileNoteEditorOpen
        onCloseFileNoteEditor={onCloseFileNoteEditor}
      />,
    );

    // When: the user writes and saves a file note
    await user.type(screen.getByRole('textbox'), 'new file note');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: the note target is file-level and the editor closes
    expect(onAddNote).toHaveBeenCalledWith({ kind: 'file', path: 'src/file.ts' }, 'new file note');
    expect(onCloseFileNoteEditor).toHaveBeenCalled();
  });

  it('renders file notes before diff rows and line notes below their lines', () => {
    // Given: a file note and a line note are both attached to the selected file
    const { container } = render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createTextFile()}
        paneMode="working"
        notes={[createFileNote(), createLineNote()]}
      />,
    );

    // When: the diff is rendered
    const renderedText = container.textContent ?? '';

    // Then: the file note appears before diff content and the line note appears after it
    expect(renderedText.indexOf('file note body')).toBeLessThan(
      renderedText.indexOf('const a = 1;'),
    );
    expect(renderedText.indexOf('line note body')).toBeGreaterThan(
      renderedText.indexOf('const a = 1;'),
    );
  });

  it('moves a stale line note out of the diff rows and into the file-level area', () => {
    // Given: a line note whose anchored range no longer describes what is shown
    const { container } = render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createTextFile()}
        paneMode="working"
        notes={[
          createLineNote({
            body: 'stale note body',
            staleness: { kind: 'stale', reason: 'content-changed' },
          }),
        ]}
      />,
    );

    // When: the diff is rendered
    const renderedText = container.textContent ?? '';

    // Then: it is shown above the diff rather than pinned to a line that moved on
    expect(renderedText.indexOf('stale note body')).toBeLessThan(
      renderedText.indexOf('const a = 1;'),
    );
    // Then: it still says which range it was written against, and why it no longer applies
    expect(screen.getByText('Line 1')).toBeDefined();
    expect(screen.getByText('Stale')).toBeDefined();
    expect(screen.getByText('the file changed after this note was written')).toBeDefined();
  });

  it('adds a line note addressed by path, range and pane', async () => {
    // Given: the diff is rendered in the staged pane
    const user = userEvent.setup();
    const onAddNote = vi.fn(async () => {});
    render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createTextFile()}
        paneMode="staged"
        onAddNote={onAddNote}
      />,
    );

    // When: the user selects the same line twice and saves a note
    const lineButton = screen.getByRole('button', { name: 'Select line 1 for note' });
    await user.click(lineButton);
    await user.click(lineButton);
    await user.type(screen.getByRole('textbox'), 'line comment');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: the target carries path + a single-line range + the current pane;
    // the server resolves fileId/hunkId from it
    expect(onAddNote).toHaveBeenCalledWith(
      {
        kind: 'line',
        path: 'src/file.ts',
        startLine: 1,
        endLine: 1,
        bucket: 'staged',
      },
      'line comment',
    );
  });

  it('selects a range in either direction and opens the editor below its end line', async () => {
    // Given: three selectable lines in one hunk
    const user = userEvent.setup();
    const onAddNote = vi.fn(async () => {});
    const { container } = render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createTextFile()}
        paneMode="working"
        onAddNote={onAddNote}
      />,
    );

    // When: the user selects the last line first and the first line second
    await user.click(screen.getByRole('button', { name: 'Select line 3 for note' }));

    // Then: only the anchor is marked and the editor is not open yet
    expect(
      container.querySelector('tr[data-new-line-number="3"]')?.getAttribute('data-range-anchor'),
    ).toBe('true');
    expect(screen.queryByRole('textbox')).toBeNull();

    // When: the second endpoint is selected and the note is saved
    await user.click(screen.getByRole('button', { name: 'Select line 1 for note' }));
    expect(screen.getByText('Lines 1–3')).toBeDefined();
    await user.type(screen.getByRole('textbox'), 'range comment');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: endpoints are normalized and sent with the current pane
    expect(onAddNote).toHaveBeenCalledWith(
      {
        kind: 'line',
        path: 'src/file.ts',
        startLine: 1,
        endLine: 3,
        bucket: 'working',
      },
      'range comment',
    );
  });

  it('cancels range selection with Escape or a non-gutter click', async () => {
    // Given: a diff with an active range anchor
    const user = userEvent.setup();
    const { container } = render(
      <UnifiedDiffViewer {...viewerDependencies} file={createTextFile()} paneMode="working" />,
    );
    const firstLineButton = screen.getByRole('button', { name: 'Select line 1 for note' });
    const firstLineRow = container.querySelector('tr[data-new-line-number="1"]');
    await user.click(firstLineButton);

    // When: Escape is pressed
    await user.keyboard('{Escape}');

    // Then: the anchor is cleared
    expect(firstLineRow?.getAttribute('data-range-anchor')).toBeNull();

    // When: selection starts again and diff content is clicked
    await user.click(firstLineButton);
    const secondLineRow = container.querySelector('tr[data-new-line-number="2"]');
    await user.click(secondLineRow!);

    // Then: the outside-gutter click also clears selection
    expect(firstLineRow?.getAttribute('data-range-anchor')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('rejects a range that spans separate hunks', async () => {
    // Given: selectable endpoints in two different hunks
    const user = userEvent.setup();
    render(
      <UnifiedDiffViewer {...viewerDependencies} file={createTwoHunkFile()} paneMode="working" />,
    );

    // When: the endpoints cross the hunk boundary
    await user.click(screen.getByRole('button', { name: 'Select line 2 for note' }));
    await user.click(screen.getByRole('button', { name: 'Select line 5 for note' }));

    // Then: the editor stays closed and an actionable warning is shown
    expect(screen.getByRole('alert').textContent).toBe('Select lines within a single diff hunk.');
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('highlights every line in a range and renders its card only after the end line', () => {
    // Given: one stored note covering all three lines
    const rangeNote = createLineNote({
      body: 'range note body',
      startLine: 1,
      endLine: 3,
    });
    const { container } = render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createTextFile()}
        paneMode="working"
        notes={[rangeNote]}
      />,
    );

    // When: the diff is rendered
    const rows = [1, 2, 3].map((line) =>
      container.querySelector(`tr[data-new-line-number="${line}"]`),
    );

    // Then: every covered row is marked, while one labeled card follows line 3
    expect(rows.every((row) => row?.getAttribute('data-note-highlighted') === 'true')).toBe(true);
    expect(screen.getAllByText('range note body')).toHaveLength(1);
    expect(screen.getByText('Lines 1–3')).toBeDefined();
    const renderedText = container.textContent ?? '';
    expect(renderedText.indexOf('range note body')).toBeGreaterThan(
      renderedText.indexOf('const c = 3;'),
    );
  });

  it('shows a line note only in its own pane, and file notes in both panes', () => {
    // Given: a working-pane line note and a pane-agnostic file note
    const notes = [createFileNote(), createLineNote()];

    // When: the file is rendered in the staged pane
    const staged = render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createTextFile()}
        paneMode="staged"
        notes={notes}
      />,
    );

    // Then: the working-anchored line note is hidden (the same line number can
    // hold different content in this pane) while the file note still shows
    expect(staged.container.textContent).not.toContain('line note body');
    expect(staged.container.textContent).toContain('file note body');
    staged.unmount();

    // When: the same notes render in the working pane
    const working = render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createTextFile()}
        paneMode="working"
        notes={notes}
      />,
    );

    // Then: the line note is anchored in its own pane
    expect(working.container.textContent).toContain('line note body');
    expect(working.container.textContent).toContain('file note body');
  });

  it('renders file notes for non-text files', () => {
    // Given: a binary file has a file-level note
    const { container } = render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        file={createBinaryFile()}
        paneMode="working"
        notes={[createFileNote()]}
      />,
    );

    // When: the binary diff placeholder is rendered
    const renderedText = container.textContent ?? '';

    // Then: the file note appears before the non-text placeholder
    expect(renderedText.indexOf('file note body')).toBeLessThan(
      renderedText.indexOf('Binary file changed'),
    );
  });

  it('switches an eligible staged Markdown file between source and preview', async () => {
    // Given
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi.fn().mockResolvedValue({ lines: ['# Old', 'Same'] }),
    };
    const fileContentReader = {
      fetchFileContent: vi.fn().mockResolvedValue({ blobId: 'new-blob', lines: ['# New', 'Same'] }),
    };
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createMarkdownFile()}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
        notes={[
          createFileNote({ path: 'README.md' }),
          createLineNote({ path: 'README.md', bucket: 'staged' }),
        ]}
      />,
    );

    // When
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    expect(previewButton.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'View entire file' })).toBeDefined();
    await user.click(previewButton);

    // Then
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New' })).toBeDefined());
    expect(screen.getByRole('heading', { name: 'Old' })).toBeDefined();
    expect(previewButton.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.diff-line-marker')).toBeNull();
    expect(container.textContent).toContain('file note body');
    // Notes stay visible in Preview; only the Source-specific line selection
    // and full-file affordances are gone.
    expect(container.textContent).toContain('line note body');
    expect(screen.queryByRole('button', { name: 'Select line 1 for note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View entire file' })).toBeNull();
    expect(blobContentReader.fetchBlobContent).toHaveBeenCalledWith('repo', 'old-blob');
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledWith('repo', 'README.md');

    // When
    await user.click(screen.getByRole('button', { name: 'Source' }));

    // Then
    expect(container.querySelector('.diff-line-marker')).not.toBeNull();
    expect(container.textContent).toContain('line note body');
    expect(screen.getByRole('button', { name: 'Select line 1 for note' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'View entire file' })).toBeDefined();
  });

  it('previews an added Markdown file as entirely changed without fetching an old blob', async () => {
    // Given
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi.fn(),
    };
    const fileContentReader = {
      fetchFileContent: vi.fn().mockResolvedValue({
        blobId: 'new-blob',
        lines: ['# New document', '', 'Body'],
      }),
    };
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createAddedMarkdownFile()}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    // Then
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'New document' })).toBeDefined(),
    );
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('.markdown-preview-block'));
    expect(blocks.map((block) => block.dataset.previewKind)).toEqual(['new', 'new']);
    expect(blocks.every((block) => block.dataset.previewStatus === 'changed')).toBe(true);
    expect(container.textContent).toContain('Body');
    expect(blobContentReader.fetchBlobContent).not.toHaveBeenCalled();
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledWith('repo', 'README.md');

    // When
    await user.click(screen.getByRole('button', { name: 'Source' }));

    // Then
    expect(container.querySelector('.diff-line-marker')).not.toBeNull();
  });

  it('protects a line note draft by disabling Preview until editing finishes', async () => {
    // Given
    const user = userEvent.setup();
    const diffToolbarTarget = createDiffToolbarTarget();
    render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        diffToolbarTarget={diffToolbarTarget}
        file={createMarkdownFile()}
        paneMode="staged"
      />,
    );
    const lineButton = screen.getByRole('button', { name: 'Select line 1 for note' });
    await user.click(lineButton);
    await user.click(lineButton);
    await user.type(screen.getByRole('textbox'), 'unsaved line note');

    // When
    const previewButton = screen.getByRole('button', { name: 'Preview' });

    // Then
    expect(previewButton.hasAttribute('disabled')).toBe(true);
    expect(previewButton.getAttribute('title')).toBe(
      'Finish editing the line note before switching views.',
    );
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('unsaved line note');

    // When
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Then
    expect(previewButton.hasAttribute('disabled')).toBe(false);
  });

  it('creates a line note from Preview and protects its draft from a view switch', async () => {
    // Given
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi.fn().mockResolvedValue({ lines: ['# Old', 'Same'] }),
    };
    const fileContentReader = {
      fetchFileContent: vi.fn().mockResolvedValue({ blobId: 'new-blob', lines: ['# New', 'Same'] }),
    };
    const onAddNote = vi.fn(async () => {});
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createMarkdownFile()}
        fileContentReader={fileContentReader}
        notes={[
          createLineNote({ path: 'README.md', bucket: 'staged' }),
          createLineNote({ id: 'working-note', path: 'README.md', startLine: 2, endLine: 2 }),
          createLineNote({
            id: 'stale-note',
            path: 'README.md',
            startLine: 2,
            endLine: 2,
            bucket: 'staged',
            staleness: { kind: 'stale', reason: 'content-changed' },
          }),
        ]}
        onAddNote={onAddNote}
        paneMode="staged"
        repoId="repo"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New' })).toBeDefined());

    // Then: only the live note from this pane contributes a Preview highlight
    const blocks = Array.from(container.querySelectorAll<HTMLElement>('.markdown-preview-block'));
    expect(blocks.map((block) => block.dataset.noteHighlighted)).toEqual([
      undefined,
      'true',
      undefined,
    ]);

    // When
    await user.click(screen.getByRole('button', { name: 'Add note for Line 1' }));
    await user.type(screen.getByRole('textbox'), 'preview draft');

    // Then: neither toggle may replace the view holding the draft. Re-clicking
    // the already selected Preview would refetch and remount the viewer.
    const sourceButton = screen.getByRole('button', { name: 'Source' });
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    expect(sourceButton.hasAttribute('disabled')).toBe(true);
    expect(previewButton.hasAttribute('disabled')).toBe(true);
    expect(sourceButton.getAttribute('title')).toBe(
      'Finish editing the line note before switching views.',
    );
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe('preview draft');

    // When
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then
    await waitFor(() => expect(sourceButton.hasAttribute('disabled')).toBe(false));
    expect(onAddNote).toHaveBeenCalledWith(
      {
        kind: 'line',
        path: 'README.md',
        startLine: 1,
        endLine: 1,
        bucket: 'staged',
      },
      'preview draft',
    );
  });

  it('blocks a view switch while an existing line note is being edited', async () => {
    // Given
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi.fn().mockResolvedValue({ lines: ['# Old', 'Same'] }),
    };
    const fileContentReader = {
      fetchFileContent: vi.fn().mockResolvedValue({ blobId: 'new-blob', lines: ['# New', 'Same'] }),
    };
    const onUpdateNote = vi.fn(async () => {});
    render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={createDiffToolbarTarget()}
        file={createMarkdownFile()}
        fileContentReader={fileContentReader}
        notes={[createLineNote({ path: 'README.md', bucket: 'staged' })]}
        onUpdateNote={onUpdateNote}
        paneMode="staged"
        repoId="repo"
      />,
    );
    const previewButton = screen.getByRole('button', { name: 'Preview' });

    // When: a note card in the Source view is being edited
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Then: a note card keeps its draft internally, so the switch has to be
    // blocked rather than unmounting the card.
    expect(previewButton.hasAttribute('disabled')).toBe(true);

    // When
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Then
    expect(previewButton.hasAttribute('disabled')).toBe(false);

    // When: the same note is edited from the Preview view
    await user.click(previewButton);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New' })).toBeDefined());
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), 'edited from preview');

    // Then
    expect(screen.getByRole('button', { name: 'Source' }).hasAttribute('disabled')).toBe(true);

    // When
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Source' }).hasAttribute('disabled')).toBe(false),
    );
    expect(onUpdateNote).toHaveBeenCalledWith('line-note', 'edited from preview');
  });

  it('preserves a file note draft while switching between Source and Preview', async () => {
    // Given
    const user = userEvent.setup();
    const file = createMarkdownFile();
    const blobContentReader = {
      fetchBlobContent: vi.fn().mockResolvedValue({ lines: ['# Old', 'Same'] }),
    };
    const fileContentReader = {
      fetchFileContent: vi.fn().mockResolvedValue({ blobId: 'new-blob', lines: ['# New', 'Same'] }),
    };
    const diffToolbarTarget = createDiffToolbarTarget();
    render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={file}
        fileContentReader={fileContentReader}
        isFileNoteEditorOpen
        paneMode="staged"
        repoId="repo"
      />,
    );
    await user.type(screen.getByRole('textbox'), 'unsaved file note');

    // When
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    expect(previewButton.hasAttribute('disabled')).toBe(false);
    await user.click(previewButton);

    // Then
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New' })).toBeDefined());
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('unsaved file note');

    // When
    const sourceButton = screen.getByRole('button', { name: 'Source' });
    expect(sourceButton.hasAttribute('disabled')).toBe(false);
    await user.click(sourceButton);

    // Then
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('unsaved file note');
  });

  it.each([
    { label: 'the working pane', file: createMarkdownFile(), paneMode: 'working' as const },
    {
      label: 'a non-Markdown file',
      file: createMarkdownFile({ path: 'README.txt', displayPath: 'README.txt' }),
      paneMode: 'staged' as const,
    },
    {
      label: 'a deleted file',
      file: createMarkdownFile({ status: 'deleted' }),
      paneMode: 'staged' as const,
    },
    {
      label: 'a file without an old blob id',
      file: createMarkdownFile({ oldBlobId: undefined }),
      paneMode: 'staged' as const,
    },
    {
      label: 'a file without a new blob id',
      file: createMarkdownFile({ newBlobId: undefined }),
      paneMode: 'staged' as const,
    },
  ])('does not offer Markdown preview for $label', ({ file, paneMode }) => {
    // Given
    const diffToolbarTarget = createDiffToolbarTarget();

    // When
    render(
      <UnifiedDiffViewer
        {...viewerDependencies}
        diffToolbarTarget={diffToolbarTarget}
        file={file}
        paneMode={paneMode}
      />,
    );

    // Then
    expect(screen.queryByRole('group', { name: 'Markdown view' })).toBeNull();
  });

  it('returns to source while Markdown preview is loading', async () => {
    // Given
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createMarkdownFile()}
        fileContentReader={viewerDependencies.fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    // Then
    expect(screen.getByRole('status').textContent).toContain('Loading Markdown preview');
    expect(container.querySelector('.diff-line-marker')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View entire file' })).toBeNull();

    // When
    await user.click(screen.getByRole('button', { name: 'Source' }));

    // Then
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('.diff-line-marker')).not.toBeNull();
  });

  it('shows an old blob size limit error and retries the Markdown preview', async () => {
    // Given
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi
        .fn()
        .mockRejectedValueOnce(new BlobContentFetchError('Blob is too large to display.', 413))
        .mockResolvedValue({ lines: ['# Old', 'Same'] }),
    };
    const fileContentReader = {
      fetchFileContent: vi.fn().mockResolvedValue({ blobId: 'new-blob', lines: ['# New', 'Same'] }),
    };
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createMarkdownFile()}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );

    // When
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    await user.click(previewButton);

    // Then
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Blob is too large to display.'),
    );
    expect(previewButton.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.diff-line-marker')).toBeNull();
    expect(screen.queryByRole('button', { name: 'View entire file' })).toBeNull();

    // When
    await user.click(previewButton);

    // Then
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New' })).toBeDefined());
    expect(blobContentReader.fetchBlobContent).toHaveBeenCalledTimes(2);
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledTimes(2);
  });

  it('shows a staged index size limit error and retries the added Markdown preview', async () => {
    // Given
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi.fn(),
    };
    const fileContentReader = {
      fetchFileContent: vi
        .fn()
        .mockRejectedValueOnce(
          new FileContentFetchError('File is too large to display in full.', 413),
        )
        .mockResolvedValue({
          blobId: 'new-blob',
          lines: ['# New document', '', 'Body'],
        }),
    };
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createAddedMarkdownFile()}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );

    // When
    const previewButton = screen.getByRole('button', { name: 'Preview' });
    await user.click(previewButton);

    // Then
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('File is too large to display in full.'),
    );
    expect(previewButton.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.diff-line-marker')).toBeNull();
    expect(blobContentReader.fetchBlobContent).not.toHaveBeenCalled();

    // When
    await user.click(previewButton);

    // Then
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'New document' })).toBeDefined(),
    );
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledTimes(2);
  });

  it('contains malformed diff data in Preview and still allows returning to Source', async () => {
    // Given
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const file = createMarkdownFile({
      hunks: [
        {
          id: 'invalid-hunk',
          header: '@@ -1 +1 @@',
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: 1,
          lines: [{ id: 'invalid-add', type: 'add', content: '# New' }],
        },
      ],
    });
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={{
          fetchBlobContent: vi.fn().mockResolvedValue({ lines: [] }),
        }}
        diffToolbarTarget={diffToolbarTarget}
        file={file}
        fileContentReader={{
          fetchFileContent: vi.fn().mockResolvedValue({ blobId: 'new-blob', lines: ['# New'] }),
        }}
        paneMode="staged"
        repoId="repo"
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    // Then
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Unable to render the Markdown preview. Switch to Source and try again.',
      ),
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Source' }));

    // Then
    expect(container.querySelector('.diff-line-marker')).not.toBeNull();
    consoleError.mockRestore();
  });

  it('restores an existing full source view after showing Markdown preview', async () => {
    // Given
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi.fn().mockResolvedValue({ lines: ['# Old', 'Same'] }),
    };
    const fileContentReader = {
      fetchFileContent: vi
        .fn()
        .mockResolvedValue({ blobId: 'new-blob', lines: ['# New', 'Same', 'Tail'] }),
    };
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createMarkdownFile()}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View entire file' }));
    await waitFor(() => expect(container.textContent).toContain('Tail'));

    // When
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New' })).toBeDefined());
    await user.click(screen.getByRole('button', { name: 'Source' }));

    // Then
    expect(container.textContent).toContain('Tail');
    expect(screen.queryByRole('button', { name: 'View entire file' })).toBeNull();
  });

  it('expands an eligible staged file and omits note controls from restored context', async () => {
    // Given: the staged blob has one line beyond the compact hunk
    const user = userEvent.setup();
    const fileContentReader = {
      fetchFileContent: vi.fn().mockResolvedValue({
        blobId: 'expected-blob',
        lines: ['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;'],
      }),
    };
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container } = render(
      <UnifiedDiffViewer
        blobContentReader={viewerDependencies.blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createExpandableFile()}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );

    // When
    const fullViewButton = screen.getByRole('button', { name: 'View entire file' });
    expect(fullViewButton.textContent).toBe('');
    await user.click(fullViewButton);

    // Then: the omitted line is displayed, but only hunk-origin lines offer note actions
    await waitFor(() => {
      expect(container.querySelector('tr[data-new-line-number="4"]')).not.toBeNull();
    });
    expect(screen.queryByRole('button', { name: 'View entire file' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select line 4 for note' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Select line 3 for note' })).toBeDefined();
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledWith('repo', 'src/file.ts');
  });

  it('returns an expanded file to compact view when refresh replaces the file object', async () => {
    // Given: an expanded staged file
    const user = userEvent.setup();
    const fileContentReader = {
      fetchFileContent: vi.fn().mockResolvedValue({
        blobId: 'expected-blob',
        lines: ['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;'],
      }),
    };
    const file = createExpandableFile();
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container, rerender } = render(
      <UnifiedDiffViewer
        blobContentReader={viewerDependencies.blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={file}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View entire file' }));
    await waitFor(() => {
      expect(container.querySelector('tr[data-new-line-number="4"]')).not.toBeNull();
    });

    // When: diff refresh produces a new DiffFile object for the same path
    rerender(
      <UnifiedDiffViewer
        blobContentReader={viewerDependencies.blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={{ ...file }}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );

    // Then
    expect(container.querySelector('tr[data-new-line-number="4"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'View entire file' })).toBeDefined();
  });

  it('returns a Markdown preview to source when refresh replaces the file object', async () => {
    // Given: a rendered preview for the current diff generation
    const user = userEvent.setup();
    const blobContentReader = {
      fetchBlobContent: vi
        .fn()
        .mockResolvedValueOnce({ lines: ['# Old', 'Same'] })
        .mockResolvedValueOnce({ lines: ['# New', 'Same'] }),
    };
    const fileContentReader = {
      fetchFileContent: vi
        .fn()
        .mockResolvedValueOnce({ blobId: 'new-blob', lines: ['# New', 'Same'] })
        .mockResolvedValueOnce({
          blobId: 'refreshed-new-blob',
          lines: ['# Refreshed', 'Same'],
        }),
    };
    const file = createMarkdownFile();
    const refreshedFile = createMarkdownFile({
      oldBlobId: 'refreshed-old-blob',
      newBlobId: 'refreshed-new-blob',
      hunks: [
        {
          id: 'refreshed-hunk',
          header: '@@ -1,2 +1,2 @@',
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 2,
          lines: [
            { id: 'refreshed-old-1', type: 'delete', oldLineNumber: 1, content: '# New' },
            {
              id: 'refreshed-new-1',
              type: 'add',
              newLineNumber: 1,
              content: '# Refreshed',
            },
            {
              id: 'refreshed-line-2',
              type: 'context',
              oldLineNumber: 2,
              newLineNumber: 2,
              content: 'Same',
            },
          ],
        },
      ],
    });
    const diffToolbarTarget = createDiffToolbarTarget();
    const { container, rerender } = render(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={file}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New' })).toBeDefined());

    // When: diff refresh produces a new object for the same file identity
    rerender(
      <UnifiedDiffViewer
        blobContentReader={blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={refreshedFile}
        fileContentReader={fileContentReader}
        paneMode="staged"
        repoId="repo"
      />,
    );

    // Then: stale preview content is removed and the refreshed source is shown
    expect(screen.queryByRole('heading', { name: 'New' })).toBeNull();
    expect(container.querySelector('.diff-line-marker')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Preview' }).getAttribute('aria-pressed')).toBe(
      'false',
    );

    // When: the refreshed generation is previewed
    await user.click(screen.getByRole('button', { name: 'Preview' }));

    // Then: both readers use the refreshed generation identifiers and content
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Refreshed' })).toBeDefined());
    expect(blobContentReader.fetchBlobContent).toHaveBeenLastCalledWith(
      'repo',
      'refreshed-old-blob',
    );
    expect(fileContentReader.fetchFileContent).toHaveBeenLastCalledWith('repo', 'README.md');
    expect(blobContentReader.fetchBlobContent).toHaveBeenCalledTimes(2);
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledTimes(2);
  });

  it('does not offer full view in the working pane', () => {
    // Given / When
    const diffToolbarTarget = createDiffToolbarTarget();
    render(
      <UnifiedDiffViewer
        blobContentReader={viewerDependencies.blobContentReader}
        diffToolbarTarget={diffToolbarTarget}
        file={createExpandableFile()}
        fileContentReader={viewerDependencies.fileContentReader}
        paneMode="working"
        repoId="repo"
      />,
    );

    // Then
    expect(screen.queryByRole('button', { name: 'View entire file' })).toBeNull();
  });
});
