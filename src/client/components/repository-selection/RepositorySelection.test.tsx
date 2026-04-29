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

  it('disables invalid repository buttons and shows their error', () => {
    // Given
    renderRepositorySelection({
      config: { status: 'found' },
      repositories: [
        {
          error: 'Repository path does not exist.',
          id: 'missing-repo',
          isValid: false,
          name: 'missing-repo',
          path: '/repo/missing-repo',
        },
      ],
    });

    // When
    const button = screen.getByRole('button', { name: /missing-repo/ });

    // Then
    expect(button).toHaveProperty('disabled', true);
    expect(screen.getByText('Repository path does not exist.')).toBeDefined();
  });

  it('does not select a disabled repository button', async () => {
    // Given
    const user = userEvent.setup();
    const { onSelectRepository } = renderRepositorySelection({
      config: { status: 'found' },
      repositories: [
        {
          error: 'Repository path is not a Git repository.',
          id: 'invalid-repo',
          isValid: false,
          name: 'invalid-repo',
          path: '/repo/invalid-repo',
        },
      ],
    });

    // When
    await user.click(screen.getByRole('button', { name: /invalid-repo/ }));

    // Then
    expect(onSelectRepository).not.toHaveBeenCalled();
  });

  it('shows the config path when repository config is missing', () => {
    // Given / When
    renderRepositorySelection({
      config: {
        path: '/Users/example/.config/sift/config.json',
        status: 'missing',
      },
      repositories: [],
    });

    // Then
    expect(
      screen.getByText('Config missing: /Users/example/.config/sift/config.json'),
    ).toBeDefined();
  });

  it('shows the config error when repository config is invalid', () => {
    // Given / When
    renderRepositorySelection({
      config: {
        error: 'Repository id "sift" is duplicated.',
        status: 'invalid',
      },
      repositories: [],
    });

    // Then
    expect(screen.getByText('Repository id "sift" is duplicated.')).toBeDefined();
  });

  it('opens an add repository form and submits the entered path', async () => {
    // Given
    const user = userEvent.setup();
    const { onAddRepository } = renderRepositorySelection({
      config: { status: 'found' },
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
        error={null}
        loading={false}
        onAddRepository={onAddRepository}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          config: { status: 'found' },
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
        error={null}
        loading={false}
        onAddRepository={vi.fn()}
        onRefresh={vi.fn()}
        onSelectRepository={vi.fn()}
        repositories={{
          config: { status: 'found' },
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
