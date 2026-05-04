import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDependencies } from '../composition/dependencies';
import { RepositorySelectionPage } from './RepositorySelectionPage';

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
          id: 'demo-repo',
          name: 'demo-repo',
          path: '/absolute/path/to/demo-repo',
        },
      ],
    })),
    fetchRepository: vi.fn(async (repoId) => ({
      id: repoId,
      name: repoId,
      path: `/absolute/path/to/${repoId}`,
    })),
  },
  repositoryWriter: {
    addRepository: vi.fn(async () => {}),
  },
  workspaceActions: {
    stageFile: vi.fn(),
    unstageFile: vi.fn(),
    stageAllWorkingFiles: vi.fn(),
    unstageAllStagedFiles: vi.fn(),
    discardWorkingFile: vi.fn(),
    discardAllWorkingFiles: vi.fn(),
    stageHunk: vi.fn(),
    unstageHunk: vi.fn(),
  },
  repositoryChangeSource: {
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
};

describe('RepositorySelectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders repository list and handles selection', async () => {
    // Given
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();

    // When
    render(
      <RepositorySelectionPage
        dependencies={testDependencies}
        onSelectRepository={onSelectRepository}
      />,
    );
    await screen.findByRole('heading', { name: 'Repositories' });

    // Then: repository list is rendered and selectable
    const repoButton = await screen.findByRole('button', { name: /demo-repo/ });
    expect(repoButton).toBeDefined();

    // When clicked
    await user.click(repoButton);

    // Then callback is fired
    expect(onSelectRepository).toHaveBeenCalledWith('demo-repo');
  });
});
