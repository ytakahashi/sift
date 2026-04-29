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
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          {
            id: 'line-1',
            type: 'context',
            oldLineNumber: 1,
            newLineNumber: 1,
            content: 'const a = 1;',
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
    expect(onAddNote).toHaveBeenCalledWith({ kind: 'file', fileId: 'file-1' }, 'new file note');
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
