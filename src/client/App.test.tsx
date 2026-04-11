import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../domain/diff/types';
import App from './App';
import { useDiffData } from './hooks/useDiffData';
import { useNotes } from './hooks/useNotes';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';

vi.mock('./hooks/useDiffData', () => ({
  useDiffData: vi.fn(),
}));

vi.mock('./hooks/useNotes', () => ({
  useNotes: vi.fn(),
}));

vi.mock('./hooks/useWorkspaceActions', () => ({
  useWorkspaceActions: vi.fn(),
}));

vi.mock('./components/diff/UnifiedDiffViewer', () => ({
  UnifiedDiffViewer: ({ file }: { file: DiffFile }) => (
    <div data-testid="diff-viewer">{file.displayPath}</div>
  ),
}));

function createFile(id: string, bucket: 'working' | 'staged'): DiffFile {
  return {
    id,
    bucket,
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath: `${id}.ts`,
    hunks: [],
  };
}

describe('App file list interactions', () => {
  const refresh = vi.fn();
  const clearNotes = vi.fn();
  const stageFile = vi.fn(async () => {});
  const unstageFile = vi.fn(async () => {});
  let diffState: {
    workingFiles: DiffFile[];
    stagedFiles: DiffFile[];
    loading: boolean;
    error: string | null;
    refresh: typeof refresh;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    diffState = {
      workingFiles: [
        createFile('a', 'working'),
        createFile('b', 'working'),
        createFile('c', 'working'),
      ],
      stagedFiles: [createFile('s', 'staged')],
      loading: false,
      error: null,
      refresh,
    };

    vi.mocked(useDiffData).mockImplementation(() => diffState);
    vi.mocked(useNotes).mockReturnValue({
      notes: [],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
    });
    vi.mocked(useWorkspaceActions).mockReturnValue({
      stageFile,
      unstageFile,
      stageHunk: vi.fn(),
      unstageHunk: vi.fn(),
      acting: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the diff on single click without activating', async () => {
    // Given: the app is rendered with working and staged file lists
    const user = userEvent.setup();
    render(<App />);

    // When: the user single-clicks a working file
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: the diff viewer shows the file but no stage action is triggered
    expect(stageFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('diff-viewer').textContent).toBe('b.ts');
  });

  it('stages on double click from the working list', async () => {
    // Given: the app is rendered with a working file selected
    const user = userEvent.setup();
    render(<App />);

    // When: the user double-clicks a working file
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));
    await user.dblClick(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: stageFile is called with the file's path
    expect(stageFile).toHaveBeenCalledWith('b.ts');
  });

  it('unstages on Enter from the staged list', async () => {
    // Given: a staged file is selected and the staged listbox has keyboard focus
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('option', { name: 's.tsM' }));
    // Explicitly focus the listbox so the subsequent keyboard event is routed
    // to the correct pane's keydown handler.
    const stagedList = screen.getAllByRole('listbox', { name: 'Changed files' })[1];
    stagedList.focus();

    // When: the user presses Enter
    await user.keyboard('{Enter}');

    // Then: unstageFile is called with the file's path
    expect(unstageFile).toHaveBeenCalledWith('s.ts');
  });

  it('moves from the last working file to the first staged file with ArrowDown', async () => {
    // Given: the last working file ("c") is selected and the working listbox has focus
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('option', { name: 'c.tsM' }));
    // Explicitly focus to ensure the keyboard event targets the working listbox
    // regardless of any focus side-effects from the click handler.
    const workingList = screen.getAllByRole('listbox', { name: 'Changed files' })[0];
    workingList.focus();

    // When: the user presses ArrowDown past the last working file
    await user.keyboard('{ArrowDown}');

    // Then: selection crosses into the staged pane and the diff viewer updates
    expect(screen.getByTestId('diff-viewer').textContent).toBe('s.ts');
  });

  it('moves from the first staged file to the last working file with ArrowUp', async () => {
    // Given: the first staged file ("s") is selected and the staged listbox has focus
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('option', { name: 's.tsM' }));
    // Explicitly focus to ensure the keyboard event targets the staged listbox.
    const stagedList = screen.getAllByRole('listbox', { name: 'Changed files' })[1];
    stagedList.focus();

    // When: the user presses ArrowUp past the first staged file
    await user.keyboard('{ArrowUp}');

    // Then: selection crosses back into the working pane and the diff viewer updates
    expect(screen.getByTestId('diff-viewer').textContent).toBe('c.ts');
  });
});
