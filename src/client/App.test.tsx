import type { ReactElement } from 'react';
import { cleanup, render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../domain/diff/types';
import AppComponent from './App';
import type { AppDependencies } from './composition/dependencies';
import { useDiffData } from './hooks/diff/useDiffData';
import { useNotes } from './hooks/notes/useNotes';
import { useWorkspaceActions } from './hooks/workspace-actions/useWorkspaceActions';

vi.mock('./hooks/diff/useDiffData', () => ({
  useDiffData: vi.fn(),
}));

vi.mock('./hooks/notes/useNotes', () => ({
  useNotes: vi.fn(),
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
  repositoryReader: {
    fetchRepositories: vi.fn(async () => ({
      config: {
        status: 'found' as const,
      },
      repositories: [
        {
          id: 'my-app',
          isValid: true,
          name: 'my-app',
          path: '/Users/dev/projects/my-app',
        },
      ],
    })),
    fetchRepository: vi.fn(async (repoId) => ({
      id: repoId,
      isValid: true,
      name: repoId,
      path: `/Users/dev/projects/${repoId}`,
    })),
  },
  workspaceActions: {
    stageFile: vi.fn(async () => {}),
    unstageFile: vi.fn(async () => {}),
    stageAllWorkingFiles: vi.fn(async () => {}),
    unstageAllStagedFiles: vi.fn(async () => {}),
    discardWorkingFile: vi.fn(async () => {}),
    discardAllWorkingFiles: vi.fn(async () => {}),
    stageHunk: vi.fn(async () => {}),
    unstageHunk: vi.fn(async () => {}),
  },
  repositoryChangeSource: {
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
};

function App(): ReactElement {
  return <AppComponent dependencies={testDependencies} />;
}

describe('App file list interactions', () => {
  const refresh = vi.fn();
  const clearNotes = vi.fn();
  const stageFile = vi.fn(async () => {});
  const unstageFile = vi.fn(async () => {});
  const stageAllWorkingFiles = vi.fn(async () => {});
  const unstageAllStagedFiles = vi.fn(async () => {});
  const discardWorkingFile = vi.fn(async () => {});
  const discardAllWorkingFiles = vi.fn(async () => {});
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
    window.history.pushState(null, '', '/repos/my-app');
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
      stageAllWorkingFiles,
      unstageAllStagedFiles,
      discardWorkingFile,
      discardAllWorkingFiles,
      stageHunk: vi.fn(),
      unstageHunk: vi.fn(),
      acting: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState(null, '', '/');
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

  it('passes the route repository id through repository-scoped hooks', async () => {
    // Given: the viewer is opened for a configured repository route.
    render(<App />);

    // When / Then
    expect(useDiffData).toHaveBeenCalledWith(testDependencies.diffReader, 'my-app');
    expect(useWorkspaceActions).toHaveBeenCalledWith(
      testDependencies.workspaceActions,
      'my-app',
      expect.any(Function),
    );
    await waitFor(() => {
      expect(testDependencies.repositoryChangeSource.subscribe).toHaveBeenCalledWith(
        'my-app',
        expect.any(Function),
      );
    });
  });

  it('renders the repository selection screen at root and navigates to the selected repository', async () => {
    // Given
    const user = userEvent.setup();
    window.history.pushState(null, '', '/');

    // When
    render(<App />);
    await screen.findByRole('button', { name: /my-app/ });
    await user.click(screen.getByRole('button', { name: /my-app/ }));

    // Then
    expect(window.location.pathname).toBe('/repos/my-app');
    expect(useDiffData).toHaveBeenCalledWith(testDependencies.diffReader, 'my-app');
  });

  it('passes the repository route id through repository-scoped hooks', async () => {
    // Given
    window.history.pushState(null, '', '/repos/my-app');

    // When
    render(<App />);

    // Then
    expect(useDiffData).toHaveBeenCalledWith(testDependencies.diffReader, 'my-app');
    expect(useWorkspaceActions).toHaveBeenCalledWith(
      testDependencies.workspaceActions,
      'my-app',
      expect.any(Function),
    );
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

  it('renders pane footer bulk action buttons', () => {
    // Given: app is rendered with working and staged files
    render(<App />);

    // When / Then
    expect(screen.getByRole('button', { name: 'Stage All' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Discard All' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Unstage All' })).toBeDefined();
  });

  it('calls stageAllWorkingFiles when Stage All is clicked', async () => {
    // Given: app is rendered with working files
    const user = userEvent.setup();
    render(<App />);

    // When
    await user.click(screen.getByRole('button', { name: 'Stage All' }));

    // Then
    expect(stageAllWorkingFiles).toHaveBeenCalled();
  });

  it('calls unstageAllStagedFiles when Unstage All is clicked', async () => {
    // Given: app is rendered with staged files
    const user = userEvent.setup();
    render(<App />);

    // When
    await user.click(screen.getByRole('button', { name: 'Unstage All' }));

    // Then
    expect(unstageAllStagedFiles).toHaveBeenCalled();
  });

  it('asks for confirmation before discarding all working files', async () => {
    // Given: confirmation is accepted
    const user = userEvent.setup();
    const confirmMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmMock);
    render(<App />);

    // When
    await user.click(screen.getByRole('button', { name: 'Discard All' }));

    // Then
    expect(confirmMock).toHaveBeenCalledWith('Discard all working directory changes?');
    expect(discardAllWorkingFiles).toHaveBeenCalled();
  });

  it('does not discard all working files when confirmation is cancelled', async () => {
    // Given: confirmation is cancelled
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    render(<App />);

    // When
    await user.click(screen.getByRole('button', { name: 'Discard All' }));

    // Then
    expect(discardAllWorkingFiles).not.toHaveBeenCalled();
  });

  it('disables pane footer bulk action buttons when their panes are empty', () => {
    // Given: the server reports no changed files
    diffState.workingFiles = [];
    diffState.stagedFiles = [];

    // When
    render(<App />);

    // Then
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Stage All' }).disabled).toBe(
      true,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Discard All' }).disabled).toBe(
      true,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Unstage All' }).disabled).toBe(
      true,
    );
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

  it('renders selected repository name in the header with absolute path tooltip', async () => {
    // Given: repository list data includes a selectable repository
    const user = userEvent.setup();
    window.history.pushState(null, '', '/');
    vi.mocked(testDependencies.repositoryReader.fetchRepositories).mockResolvedValueOnce({
      config: {
        status: 'found',
      },
      repositories: [
        {
          id: 'demo-repo',
          isValid: true,
          name: 'demo-repo',
          path: '/absolute/path/to/demo-repo',
        },
      ],
    });
    vi.mocked(testDependencies.repositoryReader.fetchRepository).mockResolvedValueOnce({
      id: 'demo-repo',
      isValid: true,
      name: 'demo-repo',
      path: '/absolute/path/to/demo-repo',
    });

    // When: the app is rendered
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /demo-repo/ }));

    // Then: repository name is shown and title exposes absolute path
    const repositoryName = await screen.findByText('demo-repo');
    expect(repositoryName).toBeDefined();
    expect(repositoryName.getAttribute('title')).toBe('/absolute/path/to/demo-repo');
    expect(testDependencies.repositoryReader.fetchRepositories).toHaveBeenCalledTimes(1);
    expect(testDependencies.repositoryReader.fetchRepository).toHaveBeenCalledWith('demo-repo');
  });

  it('fetches and renders repository metadata on direct route loads', async () => {
    // Given: direct route loads can resolve repository metadata from the single-repository API
    window.history.pushState(null, '', '/repos/demo-repo');
    vi.mocked(testDependencies.repositoryReader.fetchRepository).mockResolvedValueOnce({
      id: 'demo-repo',
      isValid: true,
      name: 'demo-repo',
      path: '/absolute/path/to/demo-repo',
    });

    // When: the app is rendered
    render(<App />);

    // Then: repository name is resolved without re-fetching the full repository list
    const repositoryName = await screen.findByText('demo-repo');
    expect(repositoryName.getAttribute('title')).toBe('/absolute/path/to/demo-repo');
    expect(testDependencies.repositoryReader.fetchRepositories).not.toHaveBeenCalled();
    expect(testDependencies.repositoryReader.fetchRepository).toHaveBeenCalledWith('demo-repo');
  });
});

describe('App Notes Interactions', () => {
  const refresh = vi.fn();
  const clearNotes = vi.fn();
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState(null, '', '/repos/my-app');
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
    vi.mocked(useWorkspaceActions).mockReturnValue({
      stageFile: vi.fn(),
      unstageFile: vi.fn(),
      stageAllWorkingFiles: vi.fn(),
      unstageAllStagedFiles: vi.fn(),
      discardWorkingFile: vi.fn(),
      discardAllWorkingFiles: vi.fn(),
      stageHunk: vi.fn(),
      unstageHunk: vi.fn(),
      acting: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    window.history.pushState(null, '', '/');
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
