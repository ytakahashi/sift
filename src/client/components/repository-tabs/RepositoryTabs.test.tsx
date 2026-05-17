import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositoryTabs } from './RepositoryTabs';

describe('RepositoryTabs', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no tabs', () => {
    // Given / When
    const { container } = render(
      <RepositoryTabs
        tabs={[]}
        activeId={null}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );

    // Then
    expect(container.querySelector('.repository-tabs')).toBeNull();
  });

  it('invokes onSelect with the tab id when the tab button is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <RepositoryTabs
        tabs={[
          { id: 'repo-a', name: 'Repository A' },
          { id: 'repo-b', name: 'Repository B' },
        ]}
        activeId="repo-a"
        onSelect={onSelect}
        onClose={() => undefined}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Repository B' }));

    // Then
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('repo-b');
  });

  it('invokes onClose only when the close button is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <RepositoryTabs
        tabs={[{ id: 'repo-a', name: 'Repository A' }]}
        activeId="repo-a"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    // When
    // The close button is a sibling of the select button, so clicking the close
    // button does not also fire the select handler — no stopPropagation required.
    await user.click(screen.getByRole('button', { name: 'Close Repository A' }));

    // Then
    expect(onClose).toHaveBeenCalledWith('repo-a');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the active tab button with aria-current="page"', () => {
    // Given / When
    // aria-current is placed on the interactive element (the selection button)
    // so screen readers announce it on the focused control. The close button
    // (sibling) does not carry aria-current.
    render(
      <RepositoryTabs
        tabs={[
          { id: 'repo-a', name: 'Repository A' },
          { id: 'repo-b', name: 'Repository B' },
        ]}
        activeId="repo-b"
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );

    // Then
    expect(
      screen.getByRole('button', { name: 'Repository A' }).getAttribute('aria-current'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Repository B' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(
      screen.getByRole('button', { name: 'Close Repository B' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('exposes the tab name in the close button aria-label so screen readers can disambiguate', () => {
    // Given / When
    render(
      <RepositoryTabs
        tabs={[
          { id: 'repo-a', name: 'Repository A' },
          { id: 'repo-b', name: 'Repository B' },
        ]}
        activeId="repo-a"
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );

    // Then
    expect(screen.getByRole('button', { name: 'Close Repository A' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close Repository B' })).toBeDefined();
  });
});
