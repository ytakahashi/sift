import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePaneResize } from './usePaneResize';

function ResizeHarness() {
  const {
    appMainRef,
    sidebarRef,
    sidebarStyle,
    workingPaneStyle,
    sidebarSplitterProps,
    paneSplitterProps,
  } = usePaneResize();

  return (
    <main ref={appMainRef} data-testid="app-main">
      <div ref={sidebarRef} data-testid="sidebar" style={sidebarStyle} />
      <div data-testid="working-pane" style={workingPaneStyle} />
      <div data-testid="vertical-splitter" {...sidebarSplitterProps} />
      <div data-testid="horizontal-splitter" {...paneSplitterProps} />
    </main>
  );
}

function mockRect(element: HTMLElement, width: number, height: number): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      right: width,
      bottom: height,
      left: 0,
      width,
      height,
      toJSON: () => ({}),
    }),
    configurable: true,
  });
}

describe('usePaneResize', () => {
  afterEach(() => {
    cleanup();
  });

  it('resizes sidebar width by dragging the vertical splitter', () => {
    // Given: the hook is mounted with measurable app-main and sidebar dimensions
    render(<ResizeHarness />);
    const appMain = screen.getByTestId('app-main') as HTMLElement;
    const sidebar = screen.getByTestId('sidebar') as HTMLElement;
    const splitter = screen.getByRole('separator', { name: 'Resize sidebar and diff panes' });
    mockRect(appMain, 1200, 800);
    mockRect(sidebar, 300, 800);

    // When: the user drags right and then beyond the minimum bound
    fireEvent.pointerDown(splitter, { clientX: 300 });
    fireEvent.pointerMove(window, { clientX: 500 });
    const expandedWidth = sidebar.style.width;
    fireEvent.pointerMove(window, { clientX: 100 });
    fireEvent.pointerUp(window);

    // Then: width follows drag and clamps at the configured minimum
    expect(expandedWidth).toBe('500px');
    expect(sidebar.style.width).toBe('220px');
  });

  it('stops dragging and resets body cursor on pointercancel', () => {
    // Given: dragging is started from the vertical splitter
    render(<ResizeHarness />);
    const appMain = screen.getByTestId('app-main') as HTMLElement;
    const sidebar = screen.getByTestId('sidebar') as HTMLElement;
    const splitter = screen.getByRole('separator', { name: 'Resize sidebar and diff panes' });
    mockRect(appMain, 1200, 800);
    mockRect(sidebar, 300, 800);
    fireEvent.pointerDown(splitter, { clientX: 300 });
    expect(splitter.className.includes('is-dragging')).toBe(true);
    expect(document.body.style.cursor).toBe('col-resize');

    // When: a pointercancel event interrupts dragging
    fireEvent.pointerCancel(window);

    // Then: dragging state and body cursor are reset
    expect(splitter.className.includes('is-dragging')).toBe(false);
    expect(document.body.style.cursor).toBe('');
  });
});
