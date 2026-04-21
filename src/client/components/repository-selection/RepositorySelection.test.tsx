import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RepositoryList } from '../../../domain/repository/repository';
import { RepositorySelection } from './RepositorySelection';

function renderRepositorySelection(repositories: RepositoryList) {
  const onSelectRepository = vi.fn();

  render(
    <RepositorySelection
      error={null}
      loading={false}
      onRefresh={vi.fn()}
      onSelectRepository={onSelectRepository}
      repositories={repositories}
    />,
  );

  return {
    onSelectRepository,
  };
}

describe('RepositorySelection', () => {
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
});
