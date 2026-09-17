import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryList } from '../../../domain/repository/repository';
import { RepositorySidebar, type RepositorySidebarProps } from './RepositorySidebar';

const repositories: RepositoryList = {
  invalidRepositories: [],
  repositories: [
    { id: 'sift', name: 'sift', path: '/repo/sift' },
    { id: 'app-one', name: 'App One', path: '/work/projects/app-one' },
  ],
};

function renderSidebar(overrides: Partial<RepositorySidebarProps> = {}): void {
  render(
    <RepositorySidebar
      configMissingError={null}
      currentRepositoryId="sift"
      error={null}
      loading={false}
      onSelectRepository={vi.fn()}
      repositories={repositories}
      {...overrides}
    />,
  );
}

describe('RepositorySidebar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders valid repositories as navigation rows', () => {
    // Given / When
    renderSidebar();

    // Then
    expect(screen.getByRole('button', { name: /sift/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /App One/ })).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Filter repositories' })).toBeDefined();
  });

  it('marks the current repository and does not select it again', async () => {
    // Given
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();
    renderSidebar({
      onSelectRepository,
      repositories: {
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      },
    });

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
    renderSidebar({ onSelectRepository });

    // When
    await user.click(screen.getByRole('button', { name: /App One/ }));

    // Then
    expect(onSelectRepository).toHaveBeenCalledWith('app-one');
  });

  it('does not render invalid repositories', () => {
    // Given / When
    renderSidebar({
      repositories: {
        invalidRepositories: [
          {
            id: 'missing-repo',
            name: 'missing-repo',
            path: '/repo/missing-repo',
            reason: 'Repository path does not exist.',
          },
        ],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      },
    });

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
    expect(screen.queryByRole('textbox', { name: 'Filter repositories' })).toBeNull();

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
    expect(screen.queryByRole('textbox', { name: 'Filter repositories' })).toBeNull();

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
    expect(screen.queryByRole('textbox', { name: 'Filter repositories' })).toBeNull();
  });

  it('filters repositories by name without regard to case', async () => {
    // Given
    const user = userEvent.setup();
    renderSidebar();

    // When
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'APP');

    // Then
    expect(screen.getByRole('button', { name: /App One/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /sift/ })).toBeNull();
  });

  it('filters repositories by path and selects a visible result', async () => {
    // Given
    const user = userEvent.setup();
    const onSelectRepository = vi.fn();
    renderSidebar({ onSelectRepository });

    // When
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'projects/app');
    await user.click(screen.getByRole('button', { name: /App One/ }));

    // Then
    expect(screen.queryByRole('button', { name: /sift/ })).toBeNull();
    expect(onSelectRepository).toHaveBeenCalledWith('app-one');
  });

  it('distinguishes no filter matches from an empty repository list', async () => {
    // Given
    const user = userEvent.setup();
    renderSidebar();

    // When
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), ' missing ');

    // Then
    expect(screen.getByText('No repositories match "missing".')).toBeDefined();
    expect(screen.queryByText('No repositories available.')).toBeNull();
    expect(screen.queryByRole('button', { name: /sift/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /App One/ })).toBeNull();
  });

  it('restores all repositories when the filter is cleared', async () => {
    // Given
    const user = userEvent.setup();
    renderSidebar();
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'app');
    expect(screen.queryByRole('button', { name: /sift/ })).toBeNull();

    // When
    await user.click(screen.getByRole('button', { name: 'Clear repository filter' }));

    // Then
    expect(screen.getByRole('button', { name: /sift/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /App One/ })).toBeDefined();
  });

  it('keeps the header and filter outside the scrollable repository body', () => {
    // Given / When
    renderSidebar();

    // Then
    const sidebar = screen.getByRole('complementary', { name: 'Repository list' });
    const body = sidebar.querySelector('.repository-sidebar-body');
    expect(sidebar.classList).not.toContain('scroll-area');
    expect(body?.classList).toContain('scroll-area');
    expect(body?.querySelector('.repository-sidebar-list')).not.toBeNull();
    expect(body?.querySelector('.repository-sidebar-header')).toBeNull();
    expect(body?.querySelector('.repository-sidebar-filter')).toBeNull();
  });
});
