import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the brand as a non-interactive element when onNavigateHome is omitted', () => {
    // Given / When
    render(<AppHeader actions={null} />);

    // Then
    // The brand should not be exposed as a button when there is no home navigation.
    expect(screen.queryByRole('button', { name: 'Sift' })).toBeNull();
    expect(screen.getByText('Sift')).toBeDefined();
  });

  it('renders the brand as a button and invokes onNavigateHome on click', async () => {
    // Given
    const user = userEvent.setup();
    const onNavigateHome = vi.fn();

    // When
    render(<AppHeader actions={null} onNavigateHome={onNavigateHome} />);
    await user.click(screen.getByRole('button', { name: 'Sift' }));

    // Then
    expect(onNavigateHome).toHaveBeenCalledTimes(1);
  });

  it('shows the repository label with the path as the title attribute', () => {
    // Given / When
    render(<AppHeader actions={null} repositoryLabel={{ name: 'sift', path: '/repo/sift' }} />);

    // Then
    const label = screen.getByText('sift');
    expect(label.getAttribute('title')).toBe('/repo/sift');
  });

  it('omits the repository label when repositoryLabel is not provided', () => {
    // Given / When
    render(<AppHeader actions={null} />);

    // Then
    expect(screen.queryByTitle(/\/repo\//)).toBeNull();
  });

  it('renders the error message when errorMessage is truthy', () => {
    // Given / When
    render(<AppHeader actions={null} errorMessage="Something went wrong" />);

    // Then
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('does not render the error element when errorMessage is null', () => {
    // Given / When
    const { container } = render(<AppHeader actions={null} errorMessage={null} />);

    // Then
    expect(container.querySelector('.app-header-error')).toBeNull();
  });

  it('does not render the error element when errorMessage is an empty string', () => {
    // Given / When
    // Falsy empty string should be treated the same as null — no error chip rendered.
    const { container } = render(<AppHeader actions={null} errorMessage="" />);

    // Then
    expect(container.querySelector('.app-header-error')).toBeNull();
  });

  it('renders provided action nodes in the actions slot', () => {
    // Given
    const onClick = vi.fn();

    // When
    render(
      <AppHeader
        actions={
          <button onClick={onClick} type="button">
            Refresh
          </button>
        }
      />,
    );

    // Then
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
  });
});
