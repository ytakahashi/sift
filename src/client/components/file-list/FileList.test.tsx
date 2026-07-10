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
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  let writeText: ReturnType<typeof vi.fn>;
  let pathContainerWidth: number;
  let pathMeasureWidth: number;

  beforeEach(() => {
    pathContainerWidth = 300;
    pathMeasureWidth = 100;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.classList?.contains('file-item-path') ? pathContainerWidth : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return this.classList?.contains('file-item-path-measure') ? pathMeasureWidth : 0;
      },
    });
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
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    }
    if (originalScrollWidth) {
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
    }
  });

  it('abbreviates an overflowing path and shows its full value after 500ms hover', () => {
    // Given: a nested path wider than the available file-list row
    vi.useFakeTimers();
    pathContainerWidth = 120;
    pathMeasureWidth = 400;
    const file = {
      ...createFile('long-file'),
      path: 'src/client/components/file-list/LongFileName.tsx',
      displayPath: 'src/client/components/file-list/LongFileName.tsx',
    };
    render(
      <FileList
        files={[file]}
        repoRoot="/repo/sift"
        selectedFileId={file.id}
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    );

    const abbreviatedPath = screen.getByText('.../LongFileName.tsx', {
      selector: '.file-item-path-visible',
    });

    // When: the pointer remains over the abbreviated path for less than 500ms
    fireEvent.mouseEnter(abbreviatedPath);
    act(() => {
      vi.advanceTimersByTime(499);
    });

    // Then: the full-path tooltip is not shown yet
    expect(screen.queryByRole('tooltip')).toBeNull();

    // When: the 500ms delay elapses
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Then: the complete path is shown and remains the option's accessible name
    expect(screen.getByRole('tooltip').textContent).toBe(file.path);
    expect(screen.getByRole('option', { name: `${file.path}M` })).toBeDefined();

    // When: the pointer leaves the path
    fireEvent.mouseLeave(abbreviatedPath);

    // Then: the tooltip closes immediately
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('restores the full path when the file-list row becomes wide enough', () => {
    // Given: a path initially wider than its row
    pathContainerWidth = 120;
    pathMeasureWidth = 400;
    const file = {
      ...createFile('responsive-file'),
      path: 'src/client/components/file-list/ResponsiveFile.tsx',
      displayPath: 'src/client/components/file-list/ResponsiveFile.tsx',
    };
    render(
      <FileList
        files={[file]}
        repoRoot="/repo/sift"
        selectedFileId={file.id}
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    );
    expect(
      screen.getByText('.../ResponsiveFile.tsx', {
        selector: '.file-item-path-visible',
      }),
    ).toBeDefined();

    // When: the sidebar becomes wide enough for the complete path
    pathContainerWidth = 500;
    fireEvent(window, new Event('resize'));

    // Then: the complete path is restored
    expect(
      screen.getByText(file.path, {
        selector: '.file-item-path-visible',
      }),
    ).toBeDefined();
  });

  it('keeps the longest trailing path that fits in the file-list row', () => {
    // Given: successively abbreviated path candidates with known rendered widths
    pathContainerWidth = 260;
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        if (!this.classList?.contains('file-item-path-measure')) {
          return 0;
        }

        const widthsByPrefix: Array<[string, number]> = [
          ['src/', 400],
          ['.../client/', 320],
          ['.../components/', 250],
          ['.../file-list/', 180],
          ['.../', 100],
        ];
        return widthsByPrefix.find(([prefix]) => this.textContent?.startsWith(prefix))?.[1] ?? 0;
      },
    });
    const file = {
      ...createFile('partially-abbreviated-file'),
      path: 'src/client/components/file-list/PartialFile.tsx',
      displayPath: 'src/client/components/file-list/PartialFile.tsx',
    };

    // When
    render(
      <FileList
        files={[file]}
        repoRoot="/repo/sift"
        selectedFileId={file.id}
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    );

    // Then: leading directories are omitted only until the label fits
    expect(
      screen.getByText('.../components/file-list/PartialFile.tsx', {
        selector: '.file-item-path-visible',
      }),
    ).toBeDefined();
  });

  it('restores the full path through ResizeObserver when the container widens', () => {
    // Given: a ResizeObserver stub that exposes its callback, since jsdom has
    // none and sidebar drag-resize changes the row width without firing a
    // window resize event — the production restore path relies on the observer.
    let observerCallback: ResizeObserverCallback | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();
    class ResizeObserverStub {
      constructor(callback: ResizeObserverCallback) {
        observerCallback = callback;
      }
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }
    const originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

    try {
      pathContainerWidth = 120;
      pathMeasureWidth = 400;
      const file = {
        ...createFile('observed-file'),
        path: 'src/client/components/file-list/ObservedFile.tsx',
        displayPath: 'src/client/components/file-list/ObservedFile.tsx',
      };
      render(
        <FileList
          files={[file]}
          repoRoot="/repo/sift"
          selectedFileId={file.id}
          onSelect={vi.fn()}
          onActivate={vi.fn()}
        />,
      );

      // Then: the observer is wired to the path container and the path is abbreviated
      expect(observe).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('.../ObservedFile.tsx', {
          selector: '.file-item-path-visible',
        }),
      ).toBeDefined();

      // When: the container widens and the observer reports the new size
      pathContainerWidth = 500;
      act(() => {
        observerCallback?.([], {} as ResizeObserver);
      });

      // Then: the complete path is restored without a window resize event
      expect(
        screen.getByText(file.path, {
          selector: '.file-item-path-visible',
        }),
      ).toBeDefined();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it('abbreviates both sides of an overflowing renamed path', () => {
    // Given: a renamed path wider than the available row
    pathContainerWidth = 120;
    pathMeasureWidth = 500;
    const file = {
      ...createFile('renamed-file'),
      path: 'src/client/new-location/NewFile.tsx',
      oldPath: 'src/client/old-location/OldFile.tsx',
      displayPath: 'src/client/new-location/NewFile.tsx',
      status: 'renamed' as const,
    };

    render(
      <FileList
        files={[file]}
        repoRoot="/repo/sift"
        selectedFileId={file.id}
        onSelect={vi.fn()}
        onActivate={vi.fn()}
      />,
    );

    // Then: both paths retain their file names while omitting directories
    const visiblePath = document.querySelector('.file-item-path-visible');
    expect(visiblePath?.textContent).toBe('.../OldFile.tsx → .../NewFile.tsx');
    expect(
      screen.getByRole('option', {
        name: `${file.oldPath} → ${file.path}R`,
      }),
    ).toBeDefined();
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
