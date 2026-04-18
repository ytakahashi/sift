import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryChangeSource, RepositoryChangeSubscription } from '../application/ports';
import { useAutoRefresh } from './useAutoRefresh';

type ChangeHandler = () => void;

class FakeRepositoryChangeSource implements RepositoryChangeSource {
  readonly unsubscribe = vi.fn();
  private handlers: ChangeHandler[] = [];

  subscribe(onChange: ChangeHandler): RepositoryChangeSubscription {
    this.handlers.push(onChange);
    return { unsubscribe: this.unsubscribe };
  }

  emitChange(): void {
    for (const handler of this.handlers) {
      handler();
    }
  }

  subscriptionCount(): number {
    return this.handlers.length;
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
      ({ onRefresh }: { onRefresh: () => void }) => useAutoRefresh(changeSource, onRefresh),
      { initialProps: { onRefresh: firstRefresh } },
    );

    rerender({ onRefresh: secondRefresh });

    // When: the repository change source emits a change
    act(() => {
      changeSource.emitChange();
    });

    // Then: the subscription is stable and latest callback is used
    expect(changeSource.subscriptionCount()).toBe(1);
    expect(firstRefresh).not.toHaveBeenCalled();
    expect(secondRefresh).toHaveBeenCalledTimes(1);
  });

  it('coalesces events while paused and refreshes once when resumed', () => {
    // Given: auto refresh is paused while an action is running
    const changeSource = new FakeRepositoryChangeSource();
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ paused }: { paused: boolean }) => useAutoRefresh(changeSource, refresh, { paused }),
      { initialProps: { paused: true } },
    );

    // When: multiple change events arrive while paused
    act(() => {
      changeSource.emitChange();
      changeSource.emitChange();
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
      ({ enabled }: { enabled: boolean }) => useAutoRefresh(changeSource, refresh, { enabled }),
      { initialProps: { enabled: false } },
    );

    // Then: no change subscription is opened yet
    expect(changeSource.subscriptionCount()).toBe(0);

    // When: initial loading completes
    rerender({ enabled: true });

    // Then: the change subscription is opened
    expect(changeSource.subscriptionCount()).toBe(1);
  });

  it('unsubscribes when the hook unmounts', () => {
    // Given: auto refresh is enabled
    const changeSource = new FakeRepositoryChangeSource();
    const { unmount } = renderHook(() => useAutoRefresh(changeSource, vi.fn()));

    // When: the hook unmounts
    unmount();

    // Then: the active change subscription is closed
    expect(changeSource.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
