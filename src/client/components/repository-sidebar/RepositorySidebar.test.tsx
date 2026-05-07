import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositorySidebar } from './RepositorySidebar';

describe('RepositorySidebar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders valid repositories as navigation rows', () => {
    // Given / When
    render(
      <RepositorySidebar
        configMissingError={null}
        currentRepositoryId="sift"
        error={null}
        loading={false}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [],
          repositories: [
            { id: 'sift', name: 'sift', path: '/repo/sift' },
            { id: 'app-one', name: 'app-one', path: '/repo/app-one' },
          ],
        }}
      />,
    );

    // Then
    expect(screen.getByRole('button', { name: /sift/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /app-one/ })).toBeDefined();
  });

  it('marks the current repository and does not select it again', async () => {
    // Given
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();
    render(
      <RepositorySidebar
        configMissingError={null}
        currentRepositoryId="sift"
        error={null}
        loading={false}
        onSelectRepository={onSelectRepository}
        repositories={{
          invalidRepositories: [],
          repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
        }}
      />,
    );

    // When
    const currentRepository = screen.getByRole('button', { name: /sift/ });
    await user.click(currentRepository);

    // Then
    expect(currentRepository.getAttribute('aria-current')).toBe('page');
    expect(onSelectRepository).not.toHaveBeenCalled();
  });

  it('selects another repository', async () => {
    // Given
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();
    render(
      <RepositorySidebar
        configMissingError={null}
        currentRepositoryId="sift"
        error={null}
        loading={false}
        onSelectRepository={onSelectRepository}
        repositories={{
          invalidRepositories: [],
          repositories: [
            { id: 'sift', name: 'sift', path: '/repo/sift' },
            { id: 'app-one', name: 'app-one', path: '/repo/app-one' },
          ],
        }}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: /app-one/ }));

    // Then
    expect(onSelectRepository).toHaveBeenCalledWith('app-one');
  });

  it('does not render invalid repositories', () => {
    // Given / When
    render(
      <RepositorySidebar
        configMissingError={null}
        currentRepositoryId="sift"
        error={null}
        loading={false}
        onSelectRepository={vi.fn()}
        repositories={{
          invalidRepositories: [
            {
              id: 'missing-repo',
              name: 'missing-repo',
              path: '/repo/missing-repo',
              reason: 'Repository path does not exist.',
            },
          ],
          repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
        }}
      />,
    );

    // Then
    expect(screen.queryByText('missing-repo')).toBeNull();
    expect(screen.queryByText('Repository path does not exist.')).toBeNull();
  });

  it('renders loading, error, and empty states', () => {
    // Given / When
    const { rerender } = render(
      <RepositorySidebar
        configMissingError={null}
        currentRepositoryId="sift"
        error={null}
        loading={true}
        onSelectRepository={vi.fn()}
        repositories={null}
      />,
    );

    // Then
    expect(screen.getByText('Loading repositories...')).toBeDefined();

    // When
    rerender(
      <RepositorySidebar
        configMissingError={null}
        currentRepositoryId="sift"
        error="network failed"
        loading={false}
        onSelectRepository={vi.fn()}
        repositories={null}
      />,
    );

    // Then
    expect(screen.getByText('network failed')).toBeDefined();

    // When
    rerender(
      <RepositorySidebar
        configMissingError={null}
        currentRepositoryId="sift"
        error={null}
        loading={false}
        onSelectRepository={vi.fn()}
        repositories={{ invalidRepositories: [], repositories: [] }}
      />,
    );

    // Then
    expect(screen.getByText('No repositories available.')).toBeDefined();
  });
});
