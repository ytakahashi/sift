import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryList } from '../../../domain/repository/repository';
import { RepositorySelection } from './RepositorySelection';

function renderRepositorySelection(repositories: RepositoryList): {
  onAddRepository: ReturnType<typeof vi.fn>;
  onDeleteRepository: ReturnType<typeof vi.fn>;
  onSelectRepository: ReturnType<typeof vi.fn>;
} {
  const onAddRepository = vi.fn().mockResolvedValue(true);
  const onDeleteRepository = vi.fn().mockResolvedValue(true);
  const onSelectRepository = vi.fn();

  render(
    <RepositorySelection
      addError={null}
      adding={false}
      configMissingError={null}
      deleteError={null}
      deletingRepositoryId={null}
      error={null}
      loading={false}
      onAddRepository={onAddRepository}
      onDeleteRepository={onDeleteRepository}
      onRefresh={vi.fn()}
      onSelectRepository={onSelectRepository}
      repositories={repositories}
      clearDeleteError={vi.fn()}
    />,
  );

  return {
    onAddRepository,
    onDeleteRepository,
    onSelectRepository,
  };
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
        addError={null}
        adding={false}
        configMissingError="Repository config is missing: /Users/example/.config/sift/config.json"
        deleteError={null}
        deletingRepositoryId={null}
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onDeleteRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={null}
        clearDeleteError={vi.fn()}
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
        adding={false}
        addError="Repository path is not a directory."
        configMissingError={null}
        deleteError={null}
        deletingRepositoryId={null}
        error={null}
        loading={false}
        onAddRepository={onAddRepository}
        onDeleteRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [],
        }}
        clearDeleteError={vi.fn()}
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
        addError={null}
        adding={true}
        configMissingError={null}
        deleteError={null}
        deletingRepositoryId={null}
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onDeleteRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [],
        }}
        clearDeleteError={vi.fn()}
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

  it('toggles edit mode and shows delete buttons', async () => {
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

  it('calls onDeleteRepository when a delete button is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const { onDeleteRepository } = renderRepositorySelection({
      invalidRepositories: [
        { id: 'invalid-repo', name: 'invalid-repo', path: '/repo/invalid', reason: 'Missing' },
      ],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove invalid-repo' }));

    // Then
    expect(onDeleteRepository).toHaveBeenCalledWith('invalid-repo');
  });

  it('displays deleteError when provided', () => {
    // Given / When
    render(
      <RepositorySelection
        addError={null}
        adding={false}
        configMissingError={null}
        deleteError="Repository not found."
        deletingRepositoryId={null}
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onDeleteRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={null}
        clearDeleteError={vi.fn()}
      />,
    );

    // Then
    expect(screen.getByText('Repository not found.')).toBeDefined();
  });

  it('maintains edit mode controls when rerendered with an empty list and a delete error', async () => {
    // Given
    const user = userEvent.setup();
    const { rerender } = render(
      <RepositorySelection
        addError={null}
        adding={false}
        configMissingError={null}
        deleteError={null}
        deletingRepositoryId={null}
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onDeleteRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
        }}
        clearDeleteError={vi.fn()}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    // Simulate re-render from hook state update after a failed/partial delete
    rerender(
      <RepositorySelection
        addError={null}
        adding={false}
        configMissingError={null}
        deleteError="Failed to delete repository."
        deletingRepositoryId={null}
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onDeleteRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [],
        }}
        clearDeleteError={vi.fn()}
      />,
    );

    // Then
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();
  });

  it('disables all remove buttons and actions while a deletion is in progress', async () => {
    // Given
    const user = userEvent.setup();
    const { rerender } = render(
      <RepositorySelection
        addError={null}
        adding={false}
        configMissingError={null}
        deleteError={null}
        deletingRepositoryId={null}
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onDeleteRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [
            { id: 'sift', name: 'sift', path: '/repo/sift' },
            { id: 'other-repo', name: 'other-repo', path: '/repo/other-repo' },
          ],
        }}
        clearDeleteError={vi.fn()}
      />,
    );

    // When: enter edit mode
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    // Simulate starting a deletion
    rerender(
      <RepositorySelection
        addError={null}
        adding={false}
        configMissingError={null}
        deleteError={null}
        deletingRepositoryId="sift"
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onDeleteRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [
            { id: 'sift', name: 'sift', path: '/repo/sift' },
            { id: 'other-repo', name: 'other-repo', path: '/repo/other-repo' },
          ],
        }}
        clearDeleteError={vi.fn()}
      />,
    );

    // Then: all actions should be disabled
    expect(screen.getByRole('button', { name: 'Remove sift' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Remove other-repo' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Done' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Add Repository' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', true);
  });
});
