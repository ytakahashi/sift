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
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FileList files={files} selectedFileId="a" onSelect={onSelect} onActivate={onActivate} />,
    );

    const target = screen.getByRole('option', { name: 'b.tsM' });
    await user.click(target);
    expect(onSelect).toHaveBeenCalledWith(files[1]);
    expect(onActivate).not.toHaveBeenCalled();

    await user.dblClick(target);
    expect(onActivate).toHaveBeenCalledWith(files[1]);
  });

  it('handles keyboard activation from the focused listbox', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FileList files={files} selectedFileId="b" onSelect={onSelect} onActivate={onActivate} />,
    );

    const listbox = screen.getByRole('listbox', { name: 'Changed files' });
    listbox.focus();
    await user.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenCalledWith(files[2]);

    await user.keyboard('{Enter}');
    expect(onActivate).toHaveBeenCalledWith(files[1]);
  });

  it('does not activate while disabled', async () => {
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
    await user.keyboard('{Enter}');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('moves focus to the listbox when an item is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FileList files={files} selectedFileId="a" onSelect={onSelect} onActivate={onActivate} />,
    );

    const listbox = screen.getByRole('listbox', { name: 'Changed files' });
    const target = screen.getByRole('option', { name: 'b.tsM' });

    await user.click(target);

    expect(document.activeElement).toBe(listbox);
  });
});
