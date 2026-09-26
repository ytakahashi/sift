import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositoryTabs, type RepositoryTabsProps } from './RepositoryTabs';

describe('RepositoryTabs', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderReorderableTabs({
    onMove = vi.fn<RepositoryTabsProps['onMove']>(),
    onSelect = vi.fn<RepositoryTabsProps['onSelect']>(),
  }: {
    onMove?: RepositoryTabsProps['onMove'];
    onSelect?: RepositoryTabsProps['onSelect'];
  } = {}): {
    items: NodeListOf<HTMLLIElement>;
    onMove: RepositoryTabsProps['onMove'];
    onSelect: RepositoryTabsProps['onSelect'];
  } {
    const { container } = render(
      <RepositoryTabs
        tabs={[
          { id: 'repo-a', name: 'Repository A' },
          { id: 'repo-b', name: 'Repository B' },
        ]}
        activeId="repo-a"
        onSelect={onSelect}
        onClose={() => undefined}
        onMove={onMove}
      />,
    );
    return {
      items: container.querySelectorAll<HTMLLIElement>('.repository-tab-item'),
      onMove,
      onSelect,
    };
  }

  function createDataTransfer(): Pick<DataTransfer, 'effectAllowed' | 'dropEffect' | 'setData'> {
    return {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn<(format: string, data: string) => void>(),
    };
  }

  function fireDragAt(
    type: 'dragOver' | 'drop',
    target: HTMLElement,
    clientX: number,
    dataTransfer: Partial<DataTransfer>,
  ): void {
    const event = createEvent[type](target);
    Object.defineProperty(event, 'clientX', { value: clientX });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    fireEvent(target, event);
  }

  it('renders nothing when there are no tabs', () => {
    // Given / When
    const { container } = render(
      <RepositoryTabs
        tabs={[]}
        activeId={null}
        onSelect={() => undefined}
        onClose={() => undefined}
        onMove={() => undefined}
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
        onMove={() => undefined}
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
        onMove={() => undefined}
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
        onMove={() => undefined}
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
        onMove={() => undefined}
      />,
    );

    // Then
    expect(screen.getByRole('button', { name: 'Close Repository A' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Close Repository B' })).toBeDefined();
  });

  it('does not make a single tab draggable', () => {
    // Given / When: a single tab is rendered.
    const { container } = render(
      <RepositoryTabs
        tabs={[{ id: 'repo-a', name: 'Repository A' }]}
        activeId="repo-a"
        onSelect={() => undefined}
        onClose={() => undefined}
        onMove={() => undefined}
      />,
    );

    // Then: there is no useful drag operation.
    expect(container.querySelector('.repository-tab-item')?.getAttribute('draggable')).toBe(
      'false',
    );
  });

  it('makes tabs draggable when there are multiple tabs', () => {
    // Given / When: two tabs are rendered.
    const { items } = renderReorderableTabs();

    // Then: the whole tab items can be dragged.
    expect(items[0].getAttribute('draggable')).toBe('true');
    expect(items[1].getAttribute('draggable')).toBe('true');
  });

  it('shows the drag state and uses the drop coordinate to move a tab', () => {
    // Given: two tabs and measured horizontal bounds.
    const { items, onMove, onSelect } = renderReorderableTabs();
    const dataTransfer = createDataTransfer();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      width: 100,
    } as DOMRect);

    // When: the first tab is dragged over the left half, then dropped on the right half.
    fireEvent.dragStart(items[0], { dataTransfer });
    expect(items[0].classList.contains('is-dragging')).toBe(true);
    fireDragAt('dragOver', items[1], 110, dataTransfer);
    expect(items[1].classList.contains('is-drop-before')).toBe(true);
    fireDragAt('dragOver', items[1], 180, dataTransfer);
    expect(items[1].classList.contains('is-drop-after')).toBe(true);
    fireDragAt('drop', items[1], 110, dataTransfer);

    // Then: the final pointer position wins and visual state is cleared.
    expect(onMove).toHaveBeenCalledExactlyOnceWith('repo-a', 'repo-b', 'before');
    expect(items[0].classList.contains('is-dragging')).toBe(false);
    expect(items[1].classList.contains('is-drop-before')).toBe(false);
    expect(items[1].classList.contains('is-drop-after')).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-sift-repository-tab',
      'repo-a',
    );
  });

  it('ignores external drags and clears an interrupted drag', () => {
    // Given: two tabs and an unrelated drag.
    const { items, onMove } = renderReorderableTabs();
    const dataTransfer = createDataTransfer();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
    } as DOMRect);

    // When: an external drag passes over and drops on a tab.
    fireDragAt('dragOver', items[1], 25, dataTransfer);
    fireDragAt('drop', items[1], 25, dataTransfer);

    // Then: there is no indicator or reorder.
    expect(items[1].classList.contains('is-drop-before')).toBe(false);
    expect(onMove).not.toHaveBeenCalled();

    // When: an internal drag ends without a drop.
    fireEvent.dragStart(items[0], { dataTransfer });
    fireDragAt('dragOver', items[1], 25, dataTransfer);
    fireEvent.dragEnd(items[0]);

    // Then: its temporary visual state is removed.
    expect(items[0].classList.contains('is-dragging')).toBe(false);
    expect(items[1].classList.contains('is-drop-before')).toBe(false);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('keeps the indicator while moving between controls inside the same tab', () => {
    // Given: an internal drag is over the second tab.
    const { items } = renderReorderableTabs();
    const dataTransfer = createDataTransfer();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100,
    } as DOMRect);
    fireEvent.dragStart(items[0], { dataTransfer });
    fireDragAt('dragOver', items[1], 25, dataTransfer);

    // When: the pointer moves from the label button to the close button.
    const leaveEvent = createEvent.dragLeave(items[1]);
    Object.defineProperty(leaveEvent, 'relatedTarget', {
      value: items[1].querySelector('.repository-tab-close'),
    });
    fireEvent(items[1], leaveEvent);

    // Then: the indicator remains until the pointer leaves the tab itself.
    expect(items[1].classList.contains('is-drop-before')).toBe(true);
    fireEvent.dragLeave(items[1], { relatedTarget: null });
    expect(items[1].classList.contains('is-drop-before')).toBe(false);
  });
});
