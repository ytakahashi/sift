import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDependencies } from '../composition/dependencies';
import { RepositorySelectionPage } from './RepositorySelectionPage';

const testDependencies: AppDependencies = {
  keyboardPlatform: 'other',
  blobContentReader: {
    fetchBlobContent: vi.fn(),
  },
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
    removeRepository: vi.fn(async () => {}),
    reorderRepositories: vi.fn(async () => {}),
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
  notesGateway: {
    fetchNotes: vi.fn(async () => []),
    addNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(async () => {}),
    clearNotes: vi.fn(async () => {}),
    deleteStaleNotes: vi.fn(async () => 0),
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

  it.each(['mac', 'other'] as const)(
    'focuses the filter and suspends it while adding on %s',
    async (platform) => {
      // Given
      const user = userEvent.setup();
      render(
        <RepositorySelectionPage
          dependencies={{ ...testDependencies, keyboardPlatform: platform }}
          onSelectRepository={vi.fn()}
        />,
      );
      const input = await screen.findByRole<HTMLInputElement>('textbox', {
        name: 'Filter repositories',
      });
      await user.type(input, 'demo');
      input.blur();

      // When: the produced slash needs Shift and comes from a different physical key.
      fireEvent.keyDown(document, { key: '/', code: 'Digit7', shiftKey: true });

      // Then
      expect(document.activeElement).toBe(input);
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(4);

      // When
      await user.click(screen.getByRole('button', { name: 'Add Repository' }));
      const blocked = createEvent.keyDown(document, { key: '/', cancelable: true });
      fireEvent(document, blocked);

      // Then
      expect(document.activeElement).not.toBe(input);
      expect(blocked.defaultPrevented).toBe(false);

      // When
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.keyDown(document, { key: '/' });

      // Then
      expect(document.activeElement).toBe(input);
    },
  );
});
