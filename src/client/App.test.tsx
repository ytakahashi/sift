import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
      metadata: { repoRoot: '/repo/my-app', revision: 'HEAD' as const },
      workingFiles: [],
      stagedFiles: [],
    })),
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

describe('App Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDiffData).mockReturnValue({
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
      expect(testDependencies.repositoryChangeSource.subscribe).toHaveBeenCalledWith(
        'my-app',
        expect.any(Function),
      );
    });
  });
});
