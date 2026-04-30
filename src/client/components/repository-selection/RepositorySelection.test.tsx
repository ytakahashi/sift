import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryList } from '../../../domain/repository/repository';
import { RepositorySelection } from './RepositorySelection';

function renderRepositorySelection(repositories: RepositoryList): {
  onAddRepository: ReturnType<typeof vi.fn>;
  onSelectRepository: ReturnType<typeof vi.fn>;
} {
  const onAddRepository = vi.fn().mockResolvedValue(true);
  const onSelectRepository = vi.fn();

  render(
    <RepositorySelection
      addError={null}
      adding={false}
      configMissingError={null}
      error={null}
      loading={false}
      onAddRepository={onAddRepository}
      onRefresh={vi.fn()}
      onSelectRepository={onSelectRepository}
      repositories={repositories}
    />,
  );

  return {
    onAddRepository,
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
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={null}
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
        error={null}
        loading={false}
        onAddRepository={onAddRepository}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [],
        }}
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
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [],
        }}
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
});
