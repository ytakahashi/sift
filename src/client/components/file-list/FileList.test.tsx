import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  const originalClipboard = navigator.clipboard;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    } else {
      // @ts-expect-error: cleanup requires deletion of mocked property
      delete navigator.clipboard;
    }
  });

  it('selects on single click and activates on double click', async () => {
    // Given: a rendered FileList
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onActivate = vi.fn();

    render(
      <FileList
        files={files}
        repoRoot="/repo/sift"
        selectedFileId="a"
        onSelect={onSelect}
        onActivate={onActivate}
      />,
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
      <FileList
        files={files}
        repoRoot="/repo/sift"
        selectedFileId="b"
        onSelect={onSelect}
        onActivate={onActivate}
      />,
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
        repoRoot="/repo/sift"
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
      <FileList
        files={files}
        repoRoot="/repo/sift"
        selectedFileId="a"
        onSelect={onSelect}
        onActivate={onActivate}
      />,
    );

    const listbox = screen.getByRole('listbox', { name: 'Changed files' });
    const target = screen.getByRole('option', { name: 'b.tsM' });

    // When: user clicks an item
    await user.click(target);

    // Then: it should move focus to the container listbox for keyboard accessibility
    expect(document.activeElement).toBe(listbox);
  });

  it('copies the relative path from the file context menu', async () => {
    // Given: a file list with clipboard access
    vi.useFakeTimers();
    const onSelect = vi.fn();
    const onActivate = vi.fn();
    render(
      <FileList
        files={files}
        repoRoot="/repo/sift"
        selectedFileId="a"
        onSelect={onSelect}
        onActivate={onActivate}
      />,
    );

    // When: the user opens the context menu on a file and copies its relative path
    fireEvent.contextMenu(screen.getByRole('option', { name: 'b.tsM' }), {
      clientX: 20,
      clientY: 30,
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Relative Path' }));
      await Promise.resolve();
    });

    // Then: the current file path is copied and success feedback is shown
    expect(writeText).toHaveBeenCalledWith('b.ts');
    expect(onSelect).toHaveBeenCalledWith(files[1]);
    expect(screen.getByRole('status').textContent).toBe('Copied!');
    expect(screen.getByRole('menu', { name: 'File path actions' })).toBeDefined();

    // When: the feedback duration passes
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Then: the menu and tooltip close together
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('menu', { name: 'File path actions' })).toBeNull();
  });

  it('copies the absolute path from the file context menu', async () => {
    // Given: a renamed file whose current path differs from its old path
    const renamedFile = {
      ...files[0],
      path: 'src/new-name.ts',
      oldPath: 'src/old-name.ts',
      status: 'renamed' as const,
    };
    render(
      <FileList
        files={[renamedFile]}
        repoRoot="/repo/sift"
        selectedFileId={renamedFile.id}
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    );

    // When: the user copies the absolute path
    fireEvent.contextMenu(screen.getByRole('option'), {
      clientX: 20,
      clientY: 30,
    });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Absolute Path' }));

    // Then: the repository root is joined with the renamed file's current path
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('/repo/sift/src/new-name.ts');
    });
  });

  it('closes the context menu on Escape and outside pointer interaction', () => {
    // Given: an open context menu
    render(
      <FileList
        files={files}
        repoRoot="/repo/sift"
        selectedFileId="a"
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    );
    const target = screen.getByRole('option', { name: 'b.tsM' });
    fireEvent.contextMenu(target);

    // When: Escape is pressed
    fireEvent.keyDown(document, { key: 'Escape' });

    // Then: the menu closes
    expect(screen.queryByRole('menu', { name: 'File path actions' })).toBeNull();

    // Given: the menu is opened again
    fireEvent.contextMenu(target);

    // When: the user interacts outside the menu
    fireEvent.pointerDown(document.body);

    // Then: the menu closes
    expect(screen.queryByRole('menu', { name: 'File path actions' })).toBeNull();
  });

  it('does not activate a file when its context menu is opened', async () => {
    // Given: a file list
    const onActivate = vi.fn();
    render(
      <FileList
        files={files}
        repoRoot="/repo/sift"
        selectedFileId="a"
        onSelect={vi.fn()}
        onActivate={onActivate}
      />,
    );

    // When: the user opens a file context menu
    fireEvent.contextMenu(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: the primary action is not triggered
    await waitFor(() => {
      expect(screen.getByRole('menu', { name: 'File path actions' })).toBeDefined();
    });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('closes the context menu when copying fails', async () => {
    // Given: a clipboard that rejects writes
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    writeText.mockRejectedValue(new Error('denied'));
    render(
      <FileList
        files={files}
        repoRoot="/repo/sift"
        selectedFileId="a"
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    );
    fireEvent.contextMenu(screen.getByRole('option', { name: 'b.tsM' }));

    // When: the user copies but the write rejects
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Relative Path' }));

    // Then: the failure is logged and the menu closes without success feedback
    await waitFor(() => {
      expect(screen.queryByRole('menu', { name: 'File path actions' })).toBeNull();
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(consoleError).toHaveBeenCalled();
  });

  it('keeps relative path copy available while the repository root is unavailable', async () => {
    // Given: a file list rendered before the repository root has loaded
    render(
      <FileList
        files={files}
        repoRoot={null}
        selectedFileId="a"
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    );

    // When: the user opens the context menu
    fireEvent.contextMenu(screen.getByRole('option', { name: 'b.tsM' }));

    // Then: the menu still appears with the absolute path option disabled
    const absoluteItem = screen.getByRole('menuitem', { name: 'Copy Absolute Path' });
    expect(absoluteItem).toHaveProperty('disabled', true);

    // And: the relative path can still be copied
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Relative Path' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('b.ts');
    });
  });
});
