import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDependencies } from './composition/dependencies';
import App from './App';
import { useDiffData } from './hooks/diff/useDiffData';

vi.mock('./hooks/diff/useDiffData', () => ({
  useDiffData: vi.fn(),
}));

vi.mock('./hooks/notes/useNotes', () => ({
  useNotes: vi.fn(() => ({
    notes: [],
    addNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    clearNotes: vi.fn(),
  })),
}));

vi.mock('./hooks/workspace-actions/useWorkspaceActions', () => ({
  useWorkspaceActions: vi.fn(() => ({
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
  })),
}));

vi.mock('./components/diff/UnifiedDiffViewer', () => ({
  UnifiedDiffViewer: () => <div data-testid="diff-viewer" />,
}));

const testDependencies: AppDependencies = {
  diffReader: {
    fetchDiff: vi.fn(async () => ({
      metadata: {
        repoRoot: '/repo/my-app',
        revision: 'HEAD' as const,
        head: { type: 'branch' as const, name: 'main' },
      },
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

describe('App Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDiffData).mockReturnValue({
      repoRoot: '/repo/my-app',
      head: { type: 'branch', name: 'main' },
      workingFiles: [],
      stagedFiles: [],
      loading: false,
      initialized: true,
      error: null,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    window.history.pushState(null, '', '/');
  });

  it('renders the repository selection screen at root and navigates to the selected repository', async () => {
    // Given
    const user = userEvent.setup();
    window.history.pushState(null, '', '/');

    // When
    render(<App dependencies={testDependencies} />);
    await screen.findByRole('button', { name: /my-app/ });
    await user.click(screen.getByRole('button', { name: /my-app/ }));

    // Then
    expect(window.location.pathname).toBe('/repos/my-app');
    expect(useDiffData).toHaveBeenCalledWith(testDependencies.diffReader, 'my-app');
  });

  it('navigates to repository selection from the brand button', async () => {
    // Given: the viewer is opened for a configured repository route.
    const user = userEvent.setup();
    window.history.pushState(null, '', '/repos/my-app');
    render(<App dependencies={testDependencies} />);

    // When: the user activates the Sift brand control.
    await user.click(screen.getByRole('button', { name: 'Sift' }));

    // Then: root route renders the repository selection screen.
    expect(window.location.pathname).toBe('/');
    expect(await screen.findByRole('heading', { name: 'Repositories' })).toBeDefined();
  });

  it('routes /repos/:id to viewer page with the correct repoId', async () => {
    // Given
    window.history.pushState(null, '', '/repos/my-app');

    // When
    render(<App dependencies={testDependencies} />);

    // Then
    expect(useDiffData).toHaveBeenCalledWith(testDependencies.diffReader, 'my-app');
    await waitFor(() => {
      expect(testDependencies.repositoryChangeSource.subscribe).toHaveBeenCalledWith('my-app', {
        onDiffChange: expect.any(Function),
        onNotesChange: expect.any(Function),
      });
    });
  });
});

describe('App repository tabs', () => {
  let desktopOpenListener: ((repoId: string) => void) | null;
  let notifyReady: ReturnType<typeof vi.fn<() => void>>;
  let unsubscribeDesktopListener: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    desktopOpenListener = null;
    notifyReady = vi.fn<() => void>();
    unsubscribeDesktopListener = vi.fn<() => void>();
    window.siftDesktop = {
      notifyReady,
      onOpenRepository: vi.fn((listener: (repoId: string) => void) => {
        desktopOpenListener = listener;
        return unsubscribeDesktopListener;
      }),
    };
    vi.mocked(useDiffData).mockReturnValue({
      repoRoot: '/repo/my-app',
      head: { type: 'branch', name: 'main' },
      workingFiles: [],
      stagedFiles: [],
      loading: false,
      initialized: true,
      error: null,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    delete window.siftDesktop;
    window.history.pushState(null, '', '/');
  });

  it('opens a tab for the active repository on direct route load and shows the resolved name', async () => {
    // Given: direct entry to a repository route
    window.history.pushState(null, '', '/repos/my-app');

    // When
    render(<App dependencies={testDependencies} />);

    // Then: the tab bar lists the repository once metadata resolves
    expect(await screen.findByRole('navigation', { name: 'Open repositories' })).toBeDefined();
    expect(await screen.findByRole('button', { name: 'my-app' })).toBeDefined();
  });

  it('navigates to selection when the only tab is closed', async () => {
    // Given: viewing a repository
    const user = userEvent.setup();
    window.history.pushState(null, '', '/repos/my-app');
    render(<App dependencies={testDependencies} />);
    await screen.findByRole('button', { name: 'my-app' });

    // When: the close button on the active tab is clicked
    await user.click(screen.getByRole('button', { name: 'Close my-app' }));

    // Then: the app navigates back to the selection page
    expect(window.location.pathname).toBe('/');
    expect(await screen.findByRole('heading', { name: 'Repositories' })).toBeDefined();
  });

  it('does not push a new history entry when the active tab is clicked', async () => {
    // Given: viewing a repository, so its tab is active
    const user = userEvent.setup();
    window.history.pushState(null, '', '/repos/my-app');
    render(<App dependencies={testDependencies} />);
    await screen.findByRole('button', { name: 'my-app' });
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    // When: the user clicks the active tab again
    await user.click(screen.getByRole('button', { name: 'my-app' }));

    // Then: navigate is not invoked, so no duplicate URL is stacked on the
    // browser history. Without this guard, pressing Back would step through
    // the same view multiple times.
    expect(pushStateSpy).not.toHaveBeenCalled();
    pushStateSpy.mockRestore();
  });

  it('keeps tabs visible when returning to the viewer from selection', async () => {
    // Given: the user has opened a repository, then went back to selection
    const user = userEvent.setup();
    window.history.pushState(null, '', '/');
    render(<App dependencies={testDependencies} />);
    await user.click(await screen.findByRole('button', { name: /my-app/ }));
    await screen.findByRole('navigation', { name: 'Open repositories' });

    // When: the user returns to selection via the brand button
    await user.click(screen.getByRole('button', { name: 'Sift' }));
    expect(window.location.pathname).toBe('/');

    // And then opens the same repository again
    await user.click(await screen.findByRole('button', { name: /my-app/ }));

    // Then: only one tab remains (no duplicate)
    const tabBar = await screen.findByRole('navigation', { name: 'Open repositories' });
    expect(tabBar.querySelectorAll('.repository-tab-item').length).toBe(1);
  });

  it('notifies the desktop bridge when the renderer is ready and unsubscribes on unmount', () => {
    // Given
    window.history.pushState(null, '', '/');

    // When
    const { unmount } = render(<App dependencies={testDependencies} />);

    // Then
    expect(notifyReady).toHaveBeenCalledTimes(1);

    // When
    unmount();

    // Then
    expect(unsubscribeDesktopListener).toHaveBeenCalledTimes(1);
  });

  it('opens a repository from a desktop intent without clearing existing tabs', async () => {
    // Given: the app already has an in-memory tab seeded from the current route.
    window.history.pushState(null, '', '/repos/my-app');
    render(<App dependencies={testDependencies} />);
    expect(await screen.findByRole('button', { name: 'my-app' })).toBeDefined();

    // When: Electron main delivers a repository-open intent through preload.
    act(() => {
      desktopOpenListener?.('repo-b');
    });

    // Then: SPA navigation opens the requested repo while preserving the old tab.
    await waitFor(() => {
      expect(window.location.pathname).toBe('/repos/repo-b');
    });
    expect(await screen.findByRole('button', { name: 'repo-b' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'my-app' })).toBeDefined();
  });
});
