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

    // When: the user drags the splitter to:
    // 1. increase width
    fireEvent.pointerDown(splitter, { clientX: 300 });
    fireEvent.pointerMove(window, { clientX: 500 });
    const expandedWidth = sidebar.style.width;
    // 2. increase width more (above the maximum)
    fireEvent.pointerMove(window, { clientX: 1000 });
    const expandedWidth2 = sidebar.style.width;
    // 3. decrease width
    fireEvent.pointerMove(window, { clientX: 300 });
    const shrunedkWidth = sidebar.style.width;
    // 4. decrease width more (below the minimum)
    fireEvent.pointerMove(window, { clientX: 100 });
    fireEvent.pointerUp(window);
    const shrunedkWidth2 = sidebar.style.width;

    // Then: sidebar width updates to:
    // 1. the moved position (500px)
    expect(expandedWidth).toBe('500px');
    // 2. width (1200) - diff view min width (360px) = 840px
    expect(expandedWidth2).toBe('840px');
    // 3. the moved position (300px)
    expect(shrunedkWidth).toBe('300px');
    // 4. the sidebar min width (220px)
    expect(shrunedkWidth2).toBe('220px');
  });

  it('resizes working pane height by dragging the horizontal splitter', () => {
    // Given: the hook is mounted with measurable sidebar dimensions
    render(<ResizeHarness />);
    const appMain = screen.getByTestId('app-main') as HTMLElement;
    const sidebar = screen.getByTestId('sidebar') as HTMLElement;
    const workingPane = screen.getByTestId('working-pane') as HTMLElement;
    const splitter = screen.getByRole('separator', { name: 'Resize Working and Staged panes' });
    mockRect(appMain, 1200, 800);
    mockRect(sidebar, 300, 800);

    // When: the user drags the bar to:
    // 1. increase height
    fireEvent.pointerDown(splitter, { clientY: 300 });
    fireEvent.pointerMove(window, { clientY: 500 });
    const expandedHeight = workingPane.style.height;
    // 2. increase height more (above the maximum)
    fireEvent.pointerMove(window, { clientY: 1000 });
    const expandedHeight2 = workingPane.style.height;
    // 3. decrease height
    fireEvent.pointerMove(window, { clientY: 250 });
    const shrunkHeight = workingPane.style.height;
    // 4. decrease height more (below the minimum)
    fireEvent.pointerMove(window, { clientY: 50 });
    fireEvent.pointerUp(window);
    const shrunkHeight2 = workingPane.style.height;

    // Then: height follows drag and clamps at the configured minimum
    // 1. the moved position (500px)
    expect(expandedHeight).toBe('500px');
    // 2. height (800) - panel min height (120px) = 680px
    expect(expandedHeight2).toBe('680px');
    // 3. the moved position (250px)
    expect(shrunkHeight).toBe('250px');
    // 4. the panel min height (120px)
    expect(shrunkHeight2).toBe('120px');
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
