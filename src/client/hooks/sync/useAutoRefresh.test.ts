import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  RepositoryChangeHandlers,
  RepositoryChangeSource,
  RepositoryChangeSubscription,
} from '../../application/ports';
import { useAutoRefresh } from './useAutoRefresh';

class FakeRepositoryChangeSource implements RepositoryChangeSource {
  readonly unsubscribe = vi.fn();
  private handlers: RepositoryChangeHandlers[] = [];
  private repoIds: string[] = [];

  subscribe(repoId: string, handlers: RepositoryChangeHandlers): RepositoryChangeSubscription {
    this.repoIds.push(repoId);
    this.handlers.push(handlers);
    return { unsubscribe: this.unsubscribe };
  }

  emitDiffChange(): void {
    for (const handler of this.handlers) {
      handler.onDiffChange();
    }
  }

  emitNotesChange(): void {
    for (const handler of this.handlers) {
      handler.onNotesChange();
    }
  }

  subscriptionCount(): number {
    return this.handlers.length;
  }

  subscribedRepoIds(): string[] {
    return this.repoIds;
  }
}

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes once and uses the latest refresh callback', () => {
    // Given: the hook is rendered with one callback and then rerendered with another
    const changeSource = new FakeRepositoryChangeSource();
    const firstRefresh = vi.fn();
    const secondRefresh = vi.fn();
    const { rerender } = renderHook(
      ({ onRefresh }: { onRefresh: () => void }) => useAutoRefresh(changeSource, 'sift', onRefresh),
      { initialProps: { onRefresh: firstRefresh } },
    );

    rerender({ onRefresh: secondRefresh });

    // When: the repository change source emits a change
    act(() => {
      changeSource.emitDiffChange();
    });

    // Then: the subscription is stable and latest callback is used
    expect(changeSource.subscriptionCount()).toBe(1);
    expect(changeSource.subscribedRepoIds()).toEqual(['sift']);
    expect(firstRefresh).not.toHaveBeenCalled();
    expect(secondRefresh).toHaveBeenCalledTimes(1);
  });

  it('coalesces events while paused and refreshes once when resumed', () => {
    // Given: auto refresh is paused while an action is running
    const changeSource = new FakeRepositoryChangeSource();
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ paused }: { paused: boolean }) =>
        useAutoRefresh(changeSource, 'sift', refresh, { paused }),
      { initialProps: { paused: true } },
    );

    // When: multiple change events arrive while paused
    act(() => {
      changeSource.emitDiffChange();
      changeSource.emitDiffChange();
    });

    // Then: refresh is not run while paused
    expect(refresh).not.toHaveBeenCalled();

    // When: the action finishes
    rerender({ paused: false });

    // Then: pending auto refresh runs once
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not connect until enabled', () => {
    // Given: auto refresh is disabled during initial diff loading
    const changeSource = new FakeRepositoryChangeSource();
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAutoRefresh(changeSource, 'sift', refresh, { enabled }),
      { initialProps: { enabled: false } },
    );

    // Then: no change subscription is opened yet
    expect(changeSource.subscriptionCount()).toBe(0);

    // When: initial loading completes
    rerender({ enabled: true });

    // Then: the change subscription is opened
    expect(changeSource.subscriptionCount()).toBe(1);
  });

  it('invokes the latest onNotesChange handler for notes-changed events', () => {
    // Given: the hook is rendered with one notes handler and rerendered with another
    const changeSource = new FakeRepositoryChangeSource();
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const { rerender } = renderHook(
      ({ onNotesChange }: { onNotesChange: () => void }) =>
        useAutoRefresh(changeSource, 'sift', vi.fn(), { onNotesChange }),
      { initialProps: { onNotesChange: firstHandler } },
    );

    rerender({ onNotesChange: secondHandler });

    // When: the server-side notes store changes
    act(() => {
      changeSource.emitNotesChange();
    });

    // Then: the subscription is stable and the latest handler is used
    expect(changeSource.subscriptionCount()).toBe(1);
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
  });

  it('delivers notes-changed even while diff refresh is paused', () => {
    // Given: a workspace action pauses diff refresh
    const changeSource = new FakeRepositoryChangeSource();
    const refresh = vi.fn();
    const onNotesChange = vi.fn();
    renderHook(() =>
      useAutoRefresh(changeSource, 'sift', refresh, { paused: true, onNotesChange }),
    );

    // When: a notes change arrives while paused
    act(() => {
      changeSource.emitNotesChange();
    });

    // Then: notes refetch is not deferred (it cannot overwrite optimistic diff state)
    expect(onNotesChange).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('unsubscribes when the hook unmounts', () => {
    // Given: auto refresh is enabled
    const changeSource = new FakeRepositoryChangeSource();
    const { unmount } = renderHook(() => useAutoRefresh(changeSource, 'sift', vi.fn()));

    // When: the hook unmounts
    unmount();

    // Then: the active change subscription is closed
    expect(changeSource.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
