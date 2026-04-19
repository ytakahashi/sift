import { cleanup, render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../domain/diff/types';
import AppComponent from './App';
import type { AppDependencies } from './composition/dependencies';
import { useDiffData } from './hooks/diff/useDiffData';
import { useNotes } from './hooks/notes/useNotes';
import { useSession } from './hooks/session/useSession';
import { useWorkspaceActions } from './hooks/workspace-actions/useWorkspaceActions';

vi.mock('./hooks/diff/useDiffData', () => ({
  useDiffData: vi.fn(),
}));

vi.mock('./hooks/notes/useNotes', () => ({
  useNotes: vi.fn(),
}));

vi.mock('./hooks/session/useSession', () => ({
  useSession: vi.fn(),
}));

vi.mock('./hooks/workspace-actions/useWorkspaceActions', () => ({
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

const testDependencies: AppDependencies = {
  diffReader: {
    fetchDiff: vi.fn(async () => ({ workingFiles: [], stagedFiles: [] })),
  },
  sessionReader: {
    fetchSession: vi.fn(async () => ({
      mode: 'repository',
      repository: {
        name: 'sift',
        root: '/Users/dev/projects/sift',
      },
      capabilities: {
        splitView: false,
        stdinMode: false,
      },
    })),
  },
  workspaceActions: {
    stageFile: vi.fn(async () => {}),
    unstageFile: vi.fn(async () => {}),
    discardWorkingFile: vi.fn(async () => {}),
    stageHunk: vi.fn(async () => {}),
    unstageHunk: vi.fn(async () => {}),
  },
  repositoryChangeSource: {
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
};

function App() {
  return <AppComponent dependencies={testDependencies} />;
}

describe('App file list interactions', () => {
  const refresh = vi.fn();
  const clearNotes = vi.fn();
  const stageFile = vi.fn(async () => {});
  const unstageFile = vi.fn(async () => {});
  const discardWorkingFile = vi.fn(async () => {});
  let diffState: {
    workingFiles: DiffFile[];
    stagedFiles: DiffFile[];
    loading: boolean;
    initialized: boolean;
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
      initialized: true,
      error: null,
      refresh,
    };

    vi.mocked(useDiffData).mockImplementation(() => diffState);
    vi.mocked(useSession).mockReturnValue({
      repository: {
        name: 'sift',
        root: '/Users/dev/projects/sift',
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
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
      discardWorkingFile,
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

  it('shows Discard button only for working pane selection', async () => {
    // Given: app is rendered
    const user = userEvent.setup();
    render(<App />);

    // When: selecting a working file
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: Discard is visible
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();

    // When: selecting a staged file
    await user.click(screen.getByRole('option', { name: 's.tsM' }));

    // Then: Discard is hidden
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
  });

  it('calls discardWorkingFile when Discard is clicked from working pane', async () => {
    // Given: app with a selected working file
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));

    // When: Discard button is clicked
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    // Then: discard action is sent for selected path
    expect(discardWorkingFile).toHaveBeenCalledWith('b.ts');
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

  it('renders resize splitters for sidebar and stacked panes', () => {
    // Given: the app is rendered
    render(<App />);

    // When: querying the separator elements
    const verticalSplitter = screen.getByRole('separator', {
      name: 'Resize sidebar and diff panes',
    });
    const horizontalSplitter = screen.getByRole('separator', {
      name: 'Resize Working and Staged panes',
    });

    // Then: both splitters are present in the layout
    expect(verticalSplitter).toBeDefined();
    expect(horizontalSplitter).toBeDefined();
  });

  it('renders repository name in the header with absolute path tooltip', () => {
    // Given: session data includes repository information
    vi.mocked(useSession).mockReturnValue({
      repository: {
        name: 'demo-repo',
        root: '/absolute/path/to/demo-repo',
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    // When: the app is rendered
    render(<App />);

    // Then: repository name is shown and title exposes absolute path
    const repositoryName = screen.getByText('demo-repo');
    expect(repositoryName).toBeDefined();
    expect(repositoryName.getAttribute('title')).toBe('/absolute/path/to/demo-repo');
  });

  it('does not render repository name when session has no repository', () => {
    // Given: session data has no repository information
    vi.mocked(useSession).mockReturnValue({
      repository: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    // When: the app is rendered
    render(<App />);

    // Then: repository name element is omitted
    expect(screen.queryByText('demo-repo')).toBeNull();
  });
});

describe('App Notes Interactions', () => {
  const refresh = vi.fn();
  const clearNotes = vi.fn();
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
    vi.mocked(useDiffData).mockReturnValue({
      workingFiles: [],
      stagedFiles: [],
      loading: false,
      initialized: true,
      error: null,
      refresh,
    });
    vi.mocked(useSession).mockReturnValue({
      repository: {
        name: 'sift',
        root: '/Users/dev/projects/sift',
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    vi.mocked(useWorkspaceActions).mockReturnValue({
      stageFile: vi.fn(),
      unstageFile: vi.fn(),
      discardWorkingFile: vi.fn(),
      stageHunk: vi.fn(),
      unstageHunk: vi.fn(),
      acting: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    } else {
      // @ts-expect-error: cleanup requires deletion of mocked property
      delete navigator.clipboard;
    }
  });

  it('renders "View Notes" button conditionally based on notes length', () => {
    // Given: an empty notes list
    vi.mocked(useNotes).mockReturnValue({
      notes: [],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
    });

    // When
    const { rerender } = render(<App />);

    // Then: button is not in document
    expect(screen.queryByRole('button', { name: /View Notes/i })).toBeNull();

    // Given: one note is available
    vi.mocked(useNotes).mockReturnValue({
      notes: [
        {
          id: 'n1',
          target: { fileId: 'f1', hunkId: 'h1', startNewLineNumber: 1, endNewLineNumber: 1 },
          body: 'hello',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
    });

    // When
    rerender(<App />);

    // Then: button should be present
    expect(screen.getByRole('button', { name: 'View Notes (1)' })).toBeDefined();
  });

  it('toggles the NotesListModal on button click', async () => {
    // Given: one note is available
    vi.mocked(useNotes).mockReturnValue({
      notes: [
        {
          id: 'n1',
          target: { fileId: 'f1', hunkId: 'h1', startNewLineNumber: 1, endNewLineNumber: 1 },
          body: 'hello note',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
    });

    // When
    const user = userEvent.setup();
    render(<App />);

    // Then: modal is not open yet
    expect(screen.queryByText('Your Notes (1)')).toBeNull();

    // When clicked
    await user.click(screen.getByRole('button', { name: 'View Notes (1)' }));

    // Then: modal is visible
    expect(screen.getByText('Your Notes (1)')).toBeDefined();

    // When close button clicked
    await user.click(screen.getByRole('button', { name: '×' }));

    // Then: modal is hidden
    expect(screen.queryByText('Your Notes (1)')).toBeNull();
  });

  it('closes the modal automatically when all notes are deleted', async () => {
    // Given: one note is available
    vi.mocked(useNotes).mockReturnValue({
      notes: [
        {
          id: 'n1',
          target: { fileId: 'f1', hunkId: 'h1', startNewLineNumber: 1, endNewLineNumber: 1 },
          body: 'hello note',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
    });

    // When
    const user = userEvent.setup();
    const { rerender } = render(<App />);

    // When clicked to open
    await user.click(screen.getByRole('button', { name: 'View Notes (1)' }));

    // Then: modal is visible
    expect(screen.getByText('Your Notes (1)')).toBeDefined();

    // When all notes are deleted
    vi.mocked(useNotes).mockReturnValue({
      notes: [],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
    });
    rerender(<App />);

    // Then: modal is automatically hidden
    expect(screen.queryByText('Your Notes (0)')).toBeNull();
    expect(screen.queryByText('Your Notes (1)')).toBeNull();
  });

  it('copies notes to clipboard and shows tooltip', async () => {
    // Given: one note is available
    vi.mocked(useNotes).mockReturnValue({
      notes: [
        {
          id: 'n1',
          target: { fileId: 'f1', hunkId: 'h1', startNewLineNumber: 10, endNewLineNumber: 10 },
          body: 'hello clipboard',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
    });

    vi.useFakeTimers();
    render(<App />);

    // Open modal using fireEvent because combining `userEvent` and `vi.useFakeTimers` causes async processing to hang
    fireEvent.click(screen.getByRole('button', { name: 'View Notes (1)' }));

    // Tooltip should not be there initially
    expect(screen.queryByText('Copied!')).toBeNull();

    // Click copy
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    // Then: writeText was called with formatted string
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('> f1#L10\nhello clipboard');

    // Tooltip should appear
    expect(screen.getByText('Copied!')).toBeDefined();

    // When 2 seconds pass
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Then tooltip disappears
    expect(screen.queryByText('Copied!')).toBeNull();
    vi.useRealTimers();
  });
});
