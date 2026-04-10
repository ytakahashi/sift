import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import { FileList } from './FileList';

function createFile(id: string): DiffFile {
  return {
    id,
    bucket: 'working',
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath: `${id}.ts`,
    hunks: [],
  };
}

describe('FileList', () => {
  const files = [createFile('a'), createFile('b'), createFile('c')];

  afterEach(() => {
    cleanup();
  });

  it('selects on single click and activates on double click', async () => {
    // Given: a rendered FileList
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FileList files={files} selectedFileId="a" onSelect={onSelect} onActivate={onActivate} />,
    );

    const target = screen.getByRole('option', { name: 'b.tsM' });

    // When: user single clicks the target
    await user.click(target);

    // Then: it should only trigger selection
    expect(onSelect).toHaveBeenCalledWith(files[1]);
    expect(onActivate).not.toHaveBeenCalled();

    // When: user double clicks the target
    await user.dblClick(target);

    // Then: it should trigger activation
    expect(onActivate).toHaveBeenCalledWith(files[1]);
  });

  it('handles keyboard activation from the focused listbox', async () => {
    // Given: a focused FileList with item "b" selected
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FileList files={files} selectedFileId="b" onSelect={onSelect} onActivate={onActivate} />,
    );

    const listbox = screen.getByRole('listbox', { name: 'Changed files' });
    listbox.focus();

    // When: user presses ArrowDown
    await user.keyboard('{ArrowDown}');

    // Then: it triggers selection of the next item (files[2])
    expect(onSelect).toHaveBeenCalledWith(files[2]);

    // When: user presses Enter
    await user.keyboard('{Enter}');

    // Then: it triggers activation of the currently prop-selected item (files[1]).
    // Since the test does not rerender, it correctly proves that activation respects the current prop.
    expect(onActivate).toHaveBeenCalledWith(files[1]);
  });

  it('does not activate while disabled', async () => {
    // Given: a disabled FileList
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FileList
        files={files}
        selectedFileId="b"
        onSelect={onSelect}
        onActivate={onActivate}
        disabled
      />,
    );

    const listbox = screen.getByRole('listbox', { name: 'Changed files' });
    listbox.focus();

    // When: user presses Enter
    await user.keyboard('{Enter}');

    // Then: it should be ignored when the component is disabled
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('moves focus to the listbox when an item is clicked', async () => {
    // Given: a rendered FileList
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FileList files={files} selectedFileId="a" onSelect={onSelect} onActivate={onActivate} />,
    );

    const listbox = screen.getByRole('listbox', { name: 'Changed files' });
    const target = screen.getByRole('option', { name: 'b.tsM' });

    // When: user clicks an item
    await user.click(target);

    // Then: it should move focus to the container listbox for keyboard accessibility
    expect(document.activeElement).toBe(listbox);
  });
});
