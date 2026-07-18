import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import type { Note } from '../../../domain/notes/types';
import { UnifiedDiffViewer } from './UnifiedDiffViewer';

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

function createFileNote(overrides?: Partial<Note>): Note {
  return {
    id: 'file-note',
    target: { kind: 'file', fileId: 'file-1' },
    body: 'file note body',
    createdAt: 1000,
    ...overrides,
  };
}

function createLineNote(overrides?: Partial<Note>): Note {
  return {
    id: 'line-note',
    target: {
      kind: 'line',
      fileId: 'file-1',
      bucket: 'working',
      hunkId: 'hunk-1',
      startNewLineNumber: 1,
      endNewLineNumber: 1,
    },
    body: 'line note body',
    createdAt: 1000,
    ...overrides,
  };
}

const resolveFilePath = (_fileId: string): string => 'src/file.ts';

describe('UnifiedDiffViewer', () => {
  afterEach(() => {
    cleanup();
  });

  it('adds a file note from the top editor', async () => {
    // Given: the file note editor is open at the top of the diff
    const user = userEvent.setup();
    const onAddNote = vi.fn();
    const onCloseFileNoteEditor = vi.fn();
    render(
      <UnifiedDiffViewer
        file={createTextFile()}
        paneMode="working"
        onAddNote={onAddNote}
        resolveFilePath={resolveFilePath}
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
        file={createTextFile()}
        paneMode="working"
        notes={[createFileNote(), createLineNote()]}
        resolveFilePath={resolveFilePath}
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

  it('adds a line note addressed by path, range and pane', async () => {
    // Given: the diff is rendered in the staged pane
    const user = userEvent.setup();
    const onAddNote = vi.fn(async () => {});
    render(
      <UnifiedDiffViewer
        file={createTextFile()}
        paneMode="staged"
        onAddNote={onAddNote}
        resolveFilePath={resolveFilePath}
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
        file={createTextFile()}
        paneMode="working"
        onAddNote={onAddNote}
        resolveFilePath={resolveFilePath}
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
      <UnifiedDiffViewer
        file={createTextFile()}
        paneMode="working"
        resolveFilePath={resolveFilePath}
      />,
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
      <UnifiedDiffViewer
        file={createTwoHunkFile()}
        paneMode="working"
        resolveFilePath={resolveFilePath}
      />,
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
      target: {
        kind: 'line',
        fileId: 'file-1',
        bucket: 'working',
        hunkId: 'hunk-1',
        startNewLineNumber: 1,
        endNewLineNumber: 3,
      },
    });
    const { container } = render(
      <UnifiedDiffViewer
        file={createTextFile()}
        paneMode="working"
        notes={[rangeNote]}
        resolveFilePath={resolveFilePath}
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
        file={createTextFile()}
        paneMode="staged"
        notes={notes}
        resolveFilePath={resolveFilePath}
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
        file={createTextFile()}
        paneMode="working"
        notes={notes}
        resolveFilePath={resolveFilePath}
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
        file={createBinaryFile()}
        paneMode="working"
        notes={[createFileNote()]}
        resolveFilePath={resolveFilePath}
      />,
    );

    // When: the binary diff placeholder is rendered
    const renderedText = container.textContent ?? '';

    // Then: the file note appears before the non-text placeholder
    expect(renderedText.indexOf('file note body')).toBeLessThan(
      renderedText.indexOf('Binary file changed'),
    );
  });
});
