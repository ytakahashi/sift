import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositoryFilterInput } from './RepositoryFilterInput';

describe('RepositoryFilterInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the accessible search field and an additional layout class', () => {
    // Given / When
    render(<RepositoryFilterInput className="host-filter" onChange={vi.fn()} value="" />);

    // Then
    const search = screen.getByRole('search', { name: 'Repository filter' });
    expect(search.classList).toContain('repository-filter');
    expect(search.classList).toContain('host-filter');
    expect(screen.getByRole('textbox', { name: 'Filter repositories' })).toHaveProperty(
      'placeholder',
      'Filter repositories',
    );
  });

  it('reports input changes to the caller', () => {
    // Given
    const onChange = vi.fn();
    render(<RepositoryFilterInput onChange={onChange} value="" />);

    // When
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter repositories' }), {
      target: { value: 'sift' },
    });

    // Then
    // Controlled input: only the reported value is verified; the host owns the state.
    expect(onChange).toHaveBeenCalledWith('sift');
  });

  it('shows the clear button only for a non-empty value and reports a clear action', async () => {
    // Given
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<RepositoryFilterInput onChange={onChange} value="" />);
    expect(screen.queryByRole('button', { name: 'Clear repository filter' })).toBeNull();
    rerender(<RepositoryFilterInput onChange={onChange} value="sift" />);

    // When
    await user.click(screen.getByRole('button', { name: 'Clear repository filter' }));

    // Then
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('reports a clear action when Escape is pressed', () => {
    // Given
    const onChange = vi.fn();
    render(<RepositoryFilterInput onChange={onChange} value="sift" />);

    // When
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Filter repositories' }), {
      key: 'Escape',
    });

    // Then
    // Controlled input: only the reported value is verified; the host owns the state.
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not clear the value with Escape during IME composition', () => {
    // Given
    const onChange = vi.fn();
    render(<RepositoryFilterInput onChange={onChange} value="sift" />);

    // When
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Filter repositories' }), {
      isComposing: true,
      key: 'Escape',
    });

    // Then
    expect(onChange).not.toHaveBeenCalled();
  });
});
