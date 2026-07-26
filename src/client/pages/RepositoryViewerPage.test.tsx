import type { ReactElement } from 'react';
import { cleanup, render, screen, within, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
import type { AppDependencies } from '../composition/dependencies';
import { useDiffData } from '../hooks/diff/useDiffData';
import { useNotes } from '../hooks/notes/useNotes';
import { useWorkspaceActions } from '../hooks/workspace-actions/useWorkspaceActions';
import { RepositoryViewerPage } from './RepositoryViewerPage';

vi.mock('../hooks/diff/useDiffData', () => ({
  useDiffData: vi.fn(),
}));

vi.mock('../hooks/notes/useNotes', () => ({
  useNotes: vi.fn(),
}));

vi.mock('../hooks/workspace-actions/useWorkspaceActions', () => ({
  useWorkspaceActions: vi.fn(),
}));

vi.mock('../components/diff/UnifiedDiffViewer', () => ({
  UnifiedDiffViewer: ({
    file,
    isFileNoteEditorOpen,
  }: {
    file: DiffFile;
    isFileNoteEditorOpen?: boolean;
  }) => (
    <div data-testid="diff-viewer">
      {file.displayPath}
      {isFileNoteEditorOpen && <span>file note editor open</span>}
    </div>
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
    fetchDiff: vi.fn(async () => ({
      metadata: { repoRoot: '/repo/my-app', revision: 'HEAD' as const },
      workingFiles: [],
      stagedFiles: [],
    })),
  },
  fileContentReader: {
    fetchFileContent: vi.fn(),
  },
  repositoryReader: {
    fetchRepositories: vi.fn(async () => ({
      invalidRepositories: [],
      repositories: [
        {
          id: 'my-app',
          name: 'my-app',
          path: '/Users/dev/projects/my-app',
        },
      ],
    })),
    fetchRepository: vi.fn(async (repoId) => ({
      id: repoId,
      name: repoId,
      path: `/Users/dev/projects/${repoId}`,
    })),
  },
  repositoryWriter: {
    addRepository: vi.fn(async () => {}),
    removeRepository: vi.fn(async () => {}),
    reorderRepositories: vi.fn(async () => {}),
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
  notesGateway: {
    fetchNotes: vi.fn(async () => []),
    addNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(async () => {}),
    clearNotes: vi.fn(async () => {}),
  },
  repositoryChangeSource: {
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
};

function Page({
  onSelectRepository = vi.fn(),
  repoId = 'my-app',
}: {
  onSelectRepository?: (repoId: string) => void;
  repoId?: string;
} = {}): ReactElement {
  return (
    <RepositoryViewerPage
      dependencies={testDependencies}
      repoId={repoId}
      onNavigateToRoot={vi.fn()}
      onSelectRepository={onSelectRepository}
      tabs={[]}
      onSelectTab={vi.fn()}
      onCloseTab={vi.fn()}
      onRepositoryResolved={vi.fn()}
    />
  );
}

describe('RepositoryViewerPage interactions', () => {
  const refresh = vi.fn();
  const clearNotes = vi.fn();
  const stageFile = vi.fn(async () => {});
  const unstageFile = vi.fn(async () => {});
  const stageAllWorkingFiles = vi.fn(async () => {});
  const unstageAllStagedFiles = vi.fn(async () => {});
  const discardWorkingFile = vi.fn(async () => {});
  const discardAllWorkingFiles = vi.fn(async () => {});
  let diffState: {
    repoRoot: string | null;
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
      repoRoot: '/Users/dev/projects/my-app',
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
      refetchNotes: vi.fn(async () => {}),
      mutating: false,
      error: null,
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
  });

  it('opens the diff on single click without activating', async () => {
    // Given: the app is rendered with working and staged file lists
    const user = userEvent.setup();
    render(<Page />);

    // When: the user single-clicks a working file
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: the diff viewer shows the file but no stage action is triggered
    expect(stageFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('diff-viewer').textContent).toBe('b.ts');
  });

  it('passes the repoId prop through repository-scoped hooks', () => {
    // Given: the page is rendered for a specific repoId
    render(<Page />);

    // Then: the hooks receive the repoId
    expect(useDiffData).toHaveBeenCalledWith(testDependencies.diffReader, 'my-app');
    expect(useWorkspaceActions).toHaveBeenCalledWith(
      testDependencies.workspaceActions,
      'my-app',
      expect.any(Function),
    );
  });

  it('stages on double click from the working list', async () => {
    // Given: the app is rendered with a working file
    const user = userEvent.setup();
    render(<Page />);

    // When: the user double-clicks a working file
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));
    await user.dblClick(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: stageFile is called with the file's path
    expect(stageFile).toHaveBeenCalledWith('b.ts');
  });

  it('unstages on Enter from the staged list', async () => {
    // Given: a staged file is selected and the listbox has focus
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole('option', { name: 's.tsM' }));
    const stagedList = screen.getAllByRole('listbox', { name: 'Changed files' })[1];
    stagedList.focus();

    // When: the user presses Enter
    await user.keyboard('{Enter}');

    // Then: unstageFile is called
    expect(unstageFile).toHaveBeenCalledWith('s.ts');
  });

  it('shows Discard button only for working pane selection', async () => {
    // Given: app is rendered
    const user = userEvent.setup();
    render(<Page />);

    // When: selecting a working file
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: Discard is visible
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDefined();

    // When: selecting a staged file
    await user.click(screen.getByRole('option', { name: 's.tsM' }));

    // Then: Discard is hidden
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
  });

  it('opens the file note editor from the selected file header action', async () => {
    // Given: a working file is selected
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));

    // When: Add Note is clicked
    await user.click(screen.getByRole('button', { name: 'Add Note' }));

    // Then: the editor is open
    expect(screen.getByText('file note editor open')).toBeDefined();
  });

  it('hides Add Note when the selected file is a submodule', async () => {
    // Given: the working pane contains a submodule entry
    const user = userEvent.setup();
    diffState.workingFiles = [
      {
        id: 'vendor-lib',
        bucket: 'working',
        path: 'vendor/lib',
        status: 'submodule',
        kind: 'submodule',
        displayPath: 'vendor/lib',
        hunks: [],
      },
    ];
    render(<Page />);

    // When: the submodule is selected
    await user.click(screen.getByRole('option', { name: /vendor\/lib/ }));

    // Then: notes cannot be attached to submodules, so the action is hidden
    // while other file actions remain available
    expect(screen.queryByRole('button', { name: 'Add Note' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Stage file' })).toBeDefined();
  });

  it('hides an open file note editor when the same fileId resolves to a submodule in the other pane', async () => {
    // Given: a type transition leaves the same path (same DiffFile.id) as a
    // text file in working and a submodule in staged
    const user = userEvent.setup();
    diffState.workingFiles = [createFile('x', 'working')];
    diffState.stagedFiles = [
      {
        id: 'x',
        bucket: 'staged',
        path: 'x.ts',
        status: 'submodule',
        kind: 'submodule',
        displayPath: 'x.ts',
        hunks: [],
      },
    ];
    render(<Page />);

    // When: the editor is opened on the eligible working entry
    await user.click(within(screen.getAllByRole('listbox')[0]).getByRole('option'));
    await user.click(screen.getByRole('button', { name: 'Add Note' }));
    expect(screen.getByText('file note editor open')).toBeDefined();

    // When: the same-id submodule entry is selected in the staged pane
    await user.click(within(screen.getAllByRole('listbox')[1]).getByRole('option'));

    // Then: the editor is not rendered on a file that cannot take notes
    // (the fileId-keyed editor state alone would keep it open)
    expect(screen.queryByText('file note editor open')).toBeNull();
  });

  it('closes the file note editor when the selected file changes', async () => {
    // Given: the file note editor is open
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));
    await user.click(screen.getByRole('button', { name: 'Add Note' }));
    expect(screen.getByText('file note editor open')).toBeDefined();

    // When: another file is selected
    await user.click(screen.getByRole('option', { name: 'c.tsM' }));

    // Then: the editor closes
    expect(screen.queryByText('file note editor open')).toBeNull();
  });

  it('calls discardWorkingFile after confirming the modal when Discard is clicked from working pane', async () => {
    // Given: app with a selected working file
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));

    // When: Discard is clicked and confirmed
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));

    // Then: discard action is sent
    expect(discardWorkingFile).toHaveBeenCalledWith('b.ts');
  });

  it('renders pane footer bulk action buttons', () => {
    // Given/When: app is rendered
    render(<Page />);

    // Then: bulk actions are available
    expect(screen.getByRole('button', { name: 'Stage All' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Discard All' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Unstage All' })).toBeDefined();
  });

  it('calls stageAllWorkingFiles when Stage All is clicked', async () => {
    // Given: app is rendered
    const user = userEvent.setup();
    render(<Page />);

    // When: Stage All is clicked
    await user.click(screen.getByRole('button', { name: 'Stage All' }));

    // Then
    expect(stageAllWorkingFiles).toHaveBeenCalled();
  });

  it('calls unstageAllStagedFiles when Unstage All is clicked', async () => {
    // Given: app is rendered
    const user = userEvent.setup();
    render(<Page />);

    // When: Unstage All is clicked
    await user.click(screen.getByRole('button', { name: 'Unstage All' }));

    // Then
    expect(unstageAllStagedFiles).toHaveBeenCalled();
  });

  it('shows confirmation modal and discards all files on confirm', async () => {
    // Given: app is rendered
    const user = userEvent.setup();
    render(<Page />);

    // When: Discard All is clicked and confirmed
    await user.click(screen.getByRole('button', { name: 'Discard All' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    // Then
    expect(discardAllWorkingFiles).toHaveBeenCalled();
  });

  it('does not discard all working files when modal is cancelled', async () => {
    // Given: app is rendered
    const user = userEvent.setup();
    render(<Page />);

    // When: Discard All is clicked but cancelled
    await user.click(screen.getByRole('button', { name: 'Discard All' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    // Then
    expect(discardAllWorkingFiles).not.toHaveBeenCalled();
  });

  it('shows confirmation modal with file name and discards the file on confirm', async () => {
    // Given: a working file is selected
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('option', { name: 'a.tsM' }));

    // When: Discard is clicked and confirmed
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    const dialog = screen.getByRole('dialog');
    within(dialog).getByText(/a\.ts/);
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    // Then
    expect(discardWorkingFile).toHaveBeenCalled();
  });

  it('disables pane footer bulk action buttons when their panes are empty', () => {
    // Given: panes are empty
    diffState.workingFiles = [];
    diffState.stagedFiles = [];

    // When
    render(<Page />);

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

  it('disables pane footer bulk action buttons while an action is running', () => {
    // Given: an action is running
    vi.mocked(useWorkspaceActions).mockReturnValue({
      stageFile,
      unstageFile,
      stageAllWorkingFiles,
      unstageAllStagedFiles,
      discardWorkingFile,
      discardAllWorkingFiles,
      stageHunk: vi.fn(),
      unstageHunk: vi.fn(),
      acting: true,
      error: null,
    });

    // When
    render(<Page />);

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
    // Given: the last working file is selected
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole('option', { name: 'c.tsM' }));
    const workingList = screen.getAllByRole('listbox', { name: 'Changed files' })[0];
    workingList.focus();

    // When: the user presses ArrowDown
    await user.keyboard('{ArrowDown}');

    // Then: selection crosses into the staged pane
    expect(screen.getByTestId('diff-viewer').textContent).toBe('s.ts');
  });

  it('moves from the first staged file to the last working file with ArrowUp', async () => {
    // Given: the first staged file is selected
    const user = userEvent.setup();
    render(<Page />);

    await user.click(screen.getByRole('option', { name: 's.tsM' }));
    const stagedList = screen.getAllByRole('listbox', { name: 'Changed files' })[1];
    stagedList.focus();

    // When: the user presses ArrowUp
    await user.keyboard('{ArrowUp}');

    // Then: selection crosses back into the working pane
    expect(screen.getByTestId('diff-viewer').textContent).toBe('c.ts');
  });

  it('renders resize splitters for sidebar and stacked panes', () => {
    // Given/When: the app is rendered
    render(<Page />);

    // Then: splitters are present
    const verticalSplitter = screen.getByRole('separator', {
      name: 'Resize sidebar and diff panes',
    });
    const horizontalSplitter = screen.getByRole('separator', {
      name: 'Resize Working and Staged panes',
    });

    expect(verticalSplitter).toBeDefined();
    expect(horizontalSplitter).toBeDefined();
  });

  it('toggles the file list pane from the diff header', async () => {
    // Given: the app is rendered with a selected file
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: the file list pane and hide action are visible
    expect(screen.getAllByRole('listbox', { name: 'Changed files' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Hide file list' })).toBeDefined();
    expect(screen.getByRole('separator', { name: 'Resize sidebar and diff panes' })).toBeDefined();

    // When: the file list is hidden
    await user.click(screen.getByRole('button', { name: 'Hide file list' }));

    // Then: the left pane is removed, the selected diff remains, and the show action appears
    expect(screen.queryAllByRole('listbox', { name: 'Changed files' })).toHaveLength(0);
    expect(screen.queryByRole('separator', { name: 'Resize sidebar and diff panes' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show file list' })).toBeDefined();
    expect(screen.getByTestId('diff-viewer').textContent).toBe('b.ts');

    // When: the file list is shown again
    await user.click(screen.getByRole('button', { name: 'Show file list' }));

    // Then: the left pane and splitter return
    expect(screen.getAllByRole('listbox', { name: 'Changed files' })).toHaveLength(2);
    expect(screen.getByRole('separator', { name: 'Resize sidebar and diff panes' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Hide file list' })).toBeDefined();
  });

  it('renders selected repository name in the header with absolute path tooltip', async () => {
    // Given: repository list data
    vi.mocked(testDependencies.repositoryReader.fetchRepository).mockResolvedValueOnce({
      id: 'demo-repo',
      name: 'demo-repo',
      path: '/absolute/path/to/demo-repo',
    });

    // When: the app is rendered
    render(<Page repoId="demo-repo" />);

    // Then: repository name and tooltip are shown
    const repositoryName = await screen.findByText('demo-repo');
    expect(repositoryName).toBeDefined();
    expect(repositoryName.getAttribute('title')).toBe('/absolute/path/to/demo-repo');
    expect(testDependencies.repositoryReader.fetchRepository).toHaveBeenCalledWith('demo-repo');
  });

  it('fetches and renders repository metadata on direct route loads', async () => {
    // Given: direct route load
    vi.mocked(testDependencies.repositoryReader.fetchRepository).mockResolvedValueOnce({
      id: 'demo-repo',
      name: 'demo-repo',
      path: '/absolute/path/to/demo-repo',
    });

    // When: the app is rendered
    render(<Page repoId="demo-repo" />);

    // Then: metadata is rendered
    const repositoryName = await screen.findByText('demo-repo');
    expect(repositoryName.getAttribute('title')).toBe('/absolute/path/to/demo-repo');
    expect(testDependencies.repositoryReader.fetchRepositories).not.toHaveBeenCalled();
    expect(testDependencies.repositoryReader.fetchRepository).toHaveBeenCalledWith('demo-repo');
  });

  it('keeps the repository sidebar closed on initial render', () => {
    // Given / When
    render(<Page />);

    // Then
    expect(screen.queryByRole('complementary', { name: 'Repository list' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open repository sidebar' })).toBeDefined();
    expect(testDependencies.repositoryReader.fetchRepositories).not.toHaveBeenCalled();
  });

  it('opens and closes the repository sidebar from the header toggle', async () => {
    // Given
    const user = userEvent.setup();
    render(<Page />);

    // When
    await user.click(screen.getByRole('button', { name: 'Open repository sidebar' }));

    // Then
    expect(await screen.findByRole('complementary', { name: 'Repository list' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close repository sidebar' })).toBeDefined();
    expect(testDependencies.repositoryReader.fetchRepositories).toHaveBeenCalled();

    // When
    await user.click(screen.getByRole('button', { name: 'Close repository sidebar' }));

    // Then
    expect(screen.queryByRole('complementary', { name: 'Repository list' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open repository sidebar' })).toBeDefined();
  });

  it('selects another repository from the sidebar and closes it', async () => {
    // Given
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();
    vi.mocked(testDependencies.repositoryReader.fetchRepositories).mockResolvedValueOnce({
      invalidRepositories: [
        {
          id: 'invalid-repo',
          name: 'invalid-repo',
          path: '/Users/dev/projects/invalid-repo',
          reason: 'Repository path does not exist.',
        },
      ],
      repositories: [
        {
          id: 'my-app',
          name: 'my-app',
          path: '/Users/dev/projects/my-app',
        },
        {
          id: 'other-app',
          name: 'other-app',
          path: '/Users/dev/projects/other-app',
        },
      ],
    });
    render(<Page onSelectRepository={onSelectRepository} />);

    // When
    await user.click(screen.getByRole('button', { name: 'Open repository sidebar' }));
    await user.click(await screen.findByRole('button', { name: /other-app/ }));

    // Then
    expect(onSelectRepository).toHaveBeenCalledWith('other-app');
    expect(screen.queryByRole('complementary', { name: 'Repository list' })).toBeNull();
    expect(screen.queryByText('invalid-repo')).toBeNull();
  });
});

describe('RepositoryViewerPage Notes Interactions', () => {
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
      repoRoot: '/Users/dev/projects/my-app',
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
      refetchNotes: vi.fn(async () => {}),
      mutating: false,
      error: null,
    });

    // When: the app is rendered
    const { rerender } = render(<Page />);

    // Then: button is not in document
    expect(screen.queryByRole('button', { name: /View Notes/i })).toBeNull();

    // Given: one note is available
    vi.mocked(useNotes).mockReturnValue({
      notes: [
        {
          id: 'n1',
          kind: 'line',
          path: 'f1',
          startLine: 1,
          endLine: 1,
          bucket: 'working',
          body: 'hello',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
      refetchNotes: vi.fn(async () => {}),
      mutating: false,
      error: null,
    });

    // When: the app is re-rendered
    rerender(<Page />);

    // Then: button should be present
    expect(screen.getByRole('button', { name: 'View Notes (1)' })).toBeDefined();
  });

  it('toggles the NotesListModal on button click', async () => {
    // Given: one note is available
    vi.mocked(useNotes).mockReturnValue({
      notes: [
        {
          id: 'n1',
          kind: 'line',
          path: 'f1',
          startLine: 1,
          endLine: 1,
          bucket: 'working',
          body: 'hello note',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
      refetchNotes: vi.fn(async () => {}),
      mutating: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<Page />);

    // Then: modal is not open yet
    expect(screen.queryByText('Your Notes (1)')).toBeNull();

    // When: View Notes button is clicked
    await user.click(screen.getByRole('button', { name: 'View Notes (1)' }));

    // Then: modal is visible
    expect(screen.getByText('Your Notes (1)')).toBeDefined();
    expect(screen.getByTestId('notes-modal-panel').closest('.app-main')).not.toBeNull();

    // When: close button clicked
    await user.click(screen.getByRole('button', { name: '×' }));

    // Then: modal is hidden
    expect(screen.queryByText('Your Notes (1)')).toBeNull();
  });

  it("selects the note's file and closes the modal when its location is clicked", async () => {
    // Given: a working file matching the note's path is available in the diff
    vi.mocked(useDiffData).mockReturnValue({
      repoRoot: '/Users/dev/projects/my-app',
      workingFiles: [createFile('f1', 'working')],
      stagedFiles: [],
      loading: false,
      initialized: true,
      error: null,
      refresh,
    });
    vi.mocked(useNotes).mockReturnValue({
      notes: [
        {
          id: 'n1',
          kind: 'line',
          path: 'f1.ts',
          startLine: 1,
          endLine: 1,
          bucket: 'working',
          body: 'hello note',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
      refetchNotes: vi.fn(async () => {}),
      mutating: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<Page />);

    // When: the notes modal is opened and the note's location is clicked
    await user.click(screen.getByRole('button', { name: 'View Notes (1)' }));
    await user.click(screen.getByRole('button', { name: 'f1.ts#L1' }));

    // Then: the modal closes and the main pane shows the note's file
    expect(screen.queryByText('Your Notes (1)')).toBeNull();
    expect(within(screen.getByTestId('diff-viewer')).getByText('f1.ts')).toBeDefined();
  });

  it('closes the modal automatically when all notes are deleted', async () => {
    // Given: one note is available
    vi.mocked(useNotes).mockReturnValue({
      notes: [
        {
          id: 'n1',
          kind: 'line',
          path: 'f1',
          startLine: 1,
          endLine: 1,
          bucket: 'working',
          body: 'hello note',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
      refetchNotes: vi.fn(async () => {}),
      mutating: false,
      error: null,
    });

    const user = userEvent.setup();
    const { rerender } = render(<Page />);

    // When: clicked to open
    await user.click(screen.getByRole('button', { name: 'View Notes (1)' }));

    // Then: modal is visible
    expect(screen.getByText('Your Notes (1)')).toBeDefined();

    // When: all notes are deleted
    vi.mocked(useNotes).mockReturnValue({
      notes: [],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
      refetchNotes: vi.fn(async () => {}),
      mutating: false,
      error: null,
    });
    rerender(<Page />);

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
          kind: 'line',
          path: 'f1',
          startLine: 10,
          endLine: 10,
          bucket: 'working',
          body: 'hello clipboard',
          createdAt: 100,
        },
      ],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
      refetchNotes: vi.fn(async () => {}),
      mutating: false,
      error: null,
    });

    vi.useFakeTimers();
    render(<Page />);

    // Open modal using fireEvent because combining `userEvent` and `vi.useFakeTimers` causes async processing to hang
    fireEvent.click(screen.getByRole('button', { name: 'View Notes (1)' }));

    // Tooltip should not be there initially
    expect(screen.queryByText('Copied!')).toBeNull();

    // When: click copy
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    // Then: writeText was called with formatted string
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('> f1#L10\nhello clipboard');

    // And: Tooltip should appear
    expect(screen.getByText('Copied!')).toBeDefined();

    // When: 2 seconds pass
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Then: tooltip disappears
    expect(screen.queryByText('Copied!')).toBeNull();
    vi.useRealTimers();
  });
});
