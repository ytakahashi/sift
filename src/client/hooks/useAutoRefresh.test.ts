import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoRefresh } from './useAutoRefresh';

type EventHandler = () => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  onmessage: EventHandler | null = null;
  readonly close = vi.fn();
  private readonly handlers = new Map<string, EventHandler[]>();

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: EventHandler): void {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  emit(event: string): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler();
    }
  }
}

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('subscribes once and uses the latest refresh callback', () => {
    // Given: the hook is rendered with one callback and then rerendered with another
    const firstRefresh = vi.fn();
    const secondRefresh = vi.fn();
    const { rerender } = renderHook(
      ({ onRefresh }: { onRefresh: () => void }) => useAutoRefresh(onRefresh),
      { initialProps: { onRefresh: firstRefresh } },
    );

    rerender({ onRefresh: secondRefresh });

    // When: the server sends a changed event
    act(() => {
      MockEventSource.instances[0].emit('changed');
    });

    // Then: the EventSource connection is stable and latest callback is used
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/watch');
    expect(firstRefresh).not.toHaveBeenCalled();
    expect(secondRefresh).toHaveBeenCalledTimes(1);
  });

  it('coalesces events while paused and refreshes once when resumed', () => {
    // Given: auto refresh is paused while an action is running
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ paused }: { paused: boolean }) => useAutoRefresh(refresh, { paused }),
      { initialProps: { paused: true } },
    );

    // When: multiple change events arrive while paused
    act(() => {
      MockEventSource.instances[0].emit('changed');
      MockEventSource.instances[0].emit('changed');
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
    const refresh = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAutoRefresh(refresh, { enabled }),
      { initialProps: { enabled: false } },
    );

    // Then: no EventSource connection is opened yet
    expect(MockEventSource.instances).toHaveLength(0);

    // When: initial loading completes
    rerender({ enabled: true });

    // Then: the watch connection is opened
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/watch');
  });
});
