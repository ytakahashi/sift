import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilePathLabel } from './FilePathLabel';

describe('FilePathLabel', () => {
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
  let pathContainerWidth: number;
  let pathMeasureWidth: number;

  beforeEach(() => {
    // jsdom has no layout, so the widths the label measures are stubbed: the
    // container reports the space it is given and every measured candidate
    // reports the same rendered width unless a test overrides it.
    pathContainerWidth = 300;
    pathMeasureWidth = 100;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.classList?.contains('file-path-label') ? pathContainerWidth : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return this.classList?.contains('file-path-label-measure-candidate') ? pathMeasureWidth : 0;
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
    // Given: a nested path wider than the available space
    vi.useFakeTimers();
    pathContainerWidth = 120;
    pathMeasureWidth = 400;
    const path = 'src/client/components/file-list/LongFileName.tsx';
    render(<FilePathLabel path={path} />);

    const abbreviatedPath = screen.getByText('.../LongFileName.tsx', {
      selector: '.file-path-label-visible',
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

    // Then: the complete path is shown
    expect(screen.getByRole('tooltip').textContent).toBe(path);

    // When: the pointer leaves the path
    fireEvent.mouseLeave(abbreviatedPath);

    // Then: the tooltip closes immediately
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('restores the full path when the container becomes wide enough', () => {
    // Given: a path initially wider than its container
    pathContainerWidth = 120;
    pathMeasureWidth = 400;
    const path = 'src/client/components/file-list/ResponsiveFile.tsx';
    render(<FilePathLabel path={path} />);
    expect(
      screen.getByText('.../ResponsiveFile.tsx', {
        selector: '.file-path-label-visible',
      }),
    ).toBeDefined();

    // When: the container becomes wide enough for the complete path
    pathContainerWidth = 500;
    fireEvent(window, new Event('resize'));

    // Then: the complete path is restored
    expect(
      screen.getByText(path, {
        selector: '.file-path-label-visible',
      }),
    ).toBeDefined();
  });

  it('keeps the longest trailing path that fits the container', () => {
    // Given: successively abbreviated path candidates with known rendered widths
    pathContainerWidth = 260;
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        if (!this.classList?.contains('file-path-label-measure-candidate')) {
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

    // When
    render(<FilePathLabel path="src/client/components/file-list/PartialFile.tsx" />);

    // Then: leading directories are omitted only until the label fits
    expect(
      screen.getByText('.../components/file-list/PartialFile.tsx', {
        selector: '.file-path-label-visible',
      }),
    ).toBeDefined();
  });

  it('restores the full path through ResizeObserver when the container widens', () => {
    // Given: a ResizeObserver stub that exposes its callback, since jsdom has
    // none and a pane drag-resize changes the container width without firing a
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
      const path = 'src/client/components/file-list/ObservedFile.tsx';
      render(<FilePathLabel path={path} />);

      // Then: the observer is wired to the path container and the path is abbreviated
      expect(observe).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText('.../ObservedFile.tsx', {
          selector: '.file-path-label-visible',
        }),
      ).toBeDefined();

      // When: the container widens and the observer reports the new size
      pathContainerWidth = 500;
      act(() => {
        observerCallback?.([], {} as ResizeObserver);
      });

      // Then: the complete path is restored without a window resize event
      expect(
        screen.getByText(path, {
          selector: '.file-path-label-visible',
        }),
      ).toBeDefined();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it('abbreviates both sides of an overflowing renamed path', () => {
    // Given: a renamed path wider than the available space
    pathContainerWidth = 120;
    pathMeasureWidth = 500;

    render(
      <FilePathLabel
        oldPath="src/client/old-location/OldFile.tsx"
        path="src/client/new-location/NewFile.tsx"
      />,
    );

    // Then: both paths retain their file names while omitting directories
    const visiblePath = document.querySelector('.file-path-label-visible');
    expect(visiblePath?.textContent).toBe('.../OldFile.tsx → .../NewFile.tsx');
  });

  it('abbreviates only the side of a renamed path that needs it to fit', () => {
    // Given: a deeply nested old path and a root-level new path, so only the
    // old side has further candidates to abbreviate through, with rendered
    // widths that make the old side's third candidate the first that fits.
    pathContainerWidth = 260;
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        if (!this.classList?.contains('file-path-label-measure-candidate')) {
          return 0;
        }

        const widthsByPrefix: Array<[string, number]> = [
          ['src/', 500],
          ['.../client/', 430],
          ['.../components/', 360],
          ['.../file-list/', 250],
          ['.../renamed/', 200],
          ['.../OldFile.tsx', 150],
        ];
        return widthsByPrefix.find(([prefix]) => this.textContent?.startsWith(prefix))?.[1] ?? 0;
      },
    });

    // When
    render(
      <FilePathLabel
        oldPath="src/client/components/file-list/renamed/OldFile.tsx"
        path="NewFile.tsx"
      />,
    );

    // Then: the old path is abbreviated only as far as needed to fit, while
    // the root-level new path (which has no further candidates) stays intact
    const visiblePath = document.querySelector('.file-path-label-visible');
    expect(visiblePath?.textContent).toBe('.../file-list/renamed/OldFile.tsx → NewFile.tsx');
  });
});
