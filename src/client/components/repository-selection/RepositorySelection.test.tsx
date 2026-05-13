import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryList } from '../../../domain/repository/repository';
import { RepositorySelection } from './RepositorySelection';

type RepositorySelectionComponentProps = ComponentProps<typeof RepositorySelection>;

function createRepositorySelectionProps(
  repositories: RepositoryList | null,
  overrides: Partial<RepositorySelectionComponentProps> = {},
): RepositorySelectionComponentProps {
  return {
    addError: null,
    adding: false,
    configMissingError: null,
    editError: null,
    error: null,
    loading: false,
    onAddRepository: vi.fn().mockResolvedValue(true),
    onDeleteRepositories: vi.fn().mockResolvedValue(true),
    onRefresh: vi.fn(),
    onSelectRepository: vi.fn(),
    repositories,
    saving: false,
    clearEditError: vi.fn(),
    ...overrides,
  };
}

function renderRepositorySelection(
  repositories: RepositoryList,
  overrides: Partial<RepositorySelectionComponentProps> = {},
): RepositorySelectionComponentProps {
  const props = createRepositorySelectionProps(repositories, overrides);
  render(<RepositorySelection {...props} />);
  return props;
}

describe('RepositorySelection', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows invalid repositories with their reason', () => {
    // Given
    renderRepositorySelection({
      invalidRepositories: [
        {
          id: 'missing-repo',
          name: 'missing-repo',
          path: '/repo/missing-repo',
          reason: 'Repository path does not exist.',
        },
      ],
      repositories: [],
    });

    // Then
    expect(screen.getByText('missing-repo')).toBeDefined();
    expect(screen.getByText('Repository path does not exist.')).toBeDefined();
  });

  it('does not render invalid repositories as selectable buttons', () => {
    // Given
    const { onSelectRepository } = renderRepositorySelection({
      invalidRepositories: [
        {
          id: 'invalid-repo',
          name: 'invalid-repo',
          path: '/repo/invalid-repo',
          reason: 'Repository path is not a Git repository.',
        },
      ],
      repositories: [],
    });

    // Then
    expect(screen.queryByRole('button', { name: /invalid-repo/ })).toBeNull();
    expect(onSelectRepository).not.toHaveBeenCalled();
  });

  it('shows the config missing error from the fetch status handling', () => {
    // Given / When
    render(
      <RepositorySelection
        {...createRepositorySelectionProps(null, {
          configMissingError:
            'Repository config is missing: /Users/example/.config/sift/config.json',
        })}
      />,
    );

    // Then
    expect(
      screen.getByText('Repository config is missing: /Users/example/.config/sift/config.json'),
    ).toBeDefined();
  });

  it('opens an add repository form and submits the entered path', async () => {
    // Given
    const user = userEvent.setup();
    const { onAddRepository } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));
    await user.type(screen.getByRole('textbox', { name: 'Repository path' }), '/repo/sift');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    // Then
    expect(onAddRepository).toHaveBeenCalledWith('/repo/sift');
    expect(screen.queryByRole('textbox', { name: 'Repository path' })).toBeNull();
  });

  it('keeps the add repository form open when submission fails', async () => {
    // Given
    const user = userEvent.setup();
    const onAddRepository = vi.fn().mockResolvedValue(false);
    render(
      <RepositorySelection
        {...createRepositorySelectionProps(
          {
            invalidRepositories: [],
            repositories: [],
          },
          {
            addError: 'Repository path is not a directory.',
            onAddRepository,
          },
        )}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));
    await user.type(screen.getByRole('textbox', { name: 'Repository path' }), '/repo/sift');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    // Then
    expect(onAddRepository).toHaveBeenCalledWith('/repo/sift');
    expect(screen.getByRole('textbox', { name: 'Repository path' })).toBeDefined();
    expect(screen.getByText('Repository path is not a directory.')).toBeDefined();
    expect(screen.queryByText('Repository path is not a directory.')?.closest('header')).toBeNull();
  });

  it('disables add repository controls while adding', async () => {
    // Given
    const user = userEvent.setup();
    render(
      <RepositorySelection
        {...createRepositorySelectionProps(
          {
            invalidRepositories: [],
            repositories: [],
          },
          { adding: true },
        )}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));

    // Then
    expect(screen.getByRole('textbox', { name: 'Repository path' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Adding...' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
  });

  it('toggles edit mode and shows delete controls', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'my-app', name: 'my-app', path: '/repo/my-app' },
      ],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    // Then
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove sift' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove my-app' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add Repository' })).toHaveProperty('disabled', true);
  });

  it('disables selection while editing', async () => {
    // Given
    const user = userEvent.setup();
    const { onSelectRepository } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'sift/repo/sift' }));

    // Then
    expect(onSelectRepository).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'sift/repo/sift' })).toHaveProperty('disabled', true);
  });

  it('marks a repository as pending delete without committing immediately', async () => {
    // Given
    const user = userEvent.setup();
    const { onDeleteRepositories } = renderRepositorySelection({
      invalidRepositories: [
        { id: 'invalid-repo', name: 'invalid-repo', path: '/repo/invalid', reason: 'Missing' },
      ],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove invalid-repo' }));

    // Then
    expect(screen.getByRole('button', { name: 'Undo remove invalid-repo' })).toBeDefined();
    expect(onDeleteRepositories).not.toHaveBeenCalled();
  });

  it('toggles a pending delete off and exits without calling the API when no rows are pending', async () => {
    // Given
    const user = userEvent.setup();
    const { onDeleteRepositories } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove sift' }));
    await user.click(screen.getByRole('button', { name: 'Undo remove sift' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onDeleteRepositories).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit Repository List' })).toBeDefined();
  });

  it('cancels pending deletes without calling the API', async () => {
    // Given
    const user = userEvent.setup();
    const { onDeleteRepositories } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove sift' }));
    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));

    // Then
    expect(onDeleteRepositories).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit Repository List' })).toBeDefined();
  });

  it('commits pending deletes on Done', async () => {
    // Given
    const user = userEvent.setup();
    const { onDeleteRepositories } = renderRepositorySelection({
      invalidRepositories: [
        { id: 'invalid-repo', name: 'invalid-repo', path: '/repo/invalid', reason: 'Missing' },
      ],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove invalid-repo' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onDeleteRepositories).toHaveBeenCalledWith(['invalid-repo']);
    expect(screen.getByRole('button', { name: 'Edit Repository List' })).toBeDefined();
  });

  it('keeps edit mode and clears pending state when committing deletes fails', async () => {
    // Given
    const user = userEvent.setup();
    const onDeleteRepositories = vi.fn().mockResolvedValue(false);
    renderRepositorySelection(
      {
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      },
      { onDeleteRepositories },
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove sift' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onDeleteRepositories).toHaveBeenCalledWith(['sift']);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Undo remove sift' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove sift' })).toBeDefined();
  });

  it('clears editError when Cancel exits edit mode', async () => {
    // Given
    const user = userEvent.setup();
    const clearEditError = vi.fn();
    renderRepositorySelection(
      {
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      },
      {
        clearEditError,
        editError: 'Failed to delete repository.',
      },
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    clearEditError.mockClear();
    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));

    // Then
    expect(clearEditError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Edit Repository List' })).toBeDefined();
  });

  it('displays editError when provided', () => {
    // Given / When
    render(
      <RepositorySelection
        {...createRepositorySelectionProps(null, { editError: 'Repository not found.' })}
      />,
    );

    // Then
    expect(screen.getByText('Repository not found.')).toBeDefined();
  });

  it('maintains edit mode controls when rerendered with an empty list and an edit error', async () => {
    // Given
    const user = userEvent.setup();
    const initialProps = createRepositorySelectionProps({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });
    const { rerender } = render(<RepositorySelection {...initialProps} />);

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    // Simulate re-render from hook state update after a failed/partial delete.
    rerender(
      <RepositorySelection
        {...initialProps}
        editError="Failed to delete repository."
        repositories={{
          invalidRepositories: [],
          repositories: [],
        }}
      />,
    );

    // Then
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toBeDefined();
  });

  it('disables edit actions including Cancel while saving', async () => {
    // Given
    const user = userEvent.setup();
    const initialProps = createRepositorySelectionProps({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'other-repo', name: 'other-repo', path: '/repo/other-repo' },
      ],
    });
    const { rerender } = render(<RepositorySelection {...initialProps} />);

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    rerender(<RepositorySelection {...initialProps} saving={true} />);

    // Then
    expect(screen.getByRole('button', { name: 'Remove sift' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Remove other-repo' })).toHaveProperty(
      'disabled',
      true,
    );
    // Done is relabeled "Saving..." while a commit is in flight to give the
    // user feedback during the (potentially multi-request) deletion sequence.
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Saving...' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Add Repository' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', true);
  });
});
