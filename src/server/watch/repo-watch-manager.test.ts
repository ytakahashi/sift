import { describe, expect, it, vi } from 'vitest';
import { createRepoWatchManager } from './repo-watch-manager';
import type { WatchHub, WatchStream } from './watch-hub';

interface TestWatchStream extends WatchStream {
  triggerAbort: () => Promise<void>;
}

function createStream(): TestWatchStream {
  const abortListeners: Array<() => void | Promise<void>> = [];

  return {
    aborted: false,
    closed: false,
    onAbort: vi.fn((listener: () => void | Promise<void>) => {
      abortListeners.push(listener);
    }),
    triggerAbort: async () => {
      await Promise.all(abortListeners.map((listener) => listener()));
    },
    writeSSE: vi.fn().mockResolvedValue(undefined),
  };
}

function createHub(): WatchHub & {
  subscribeMock: ReturnType<typeof vi.fn>;
  unsubscribeMock: ReturnType<typeof vi.fn>;
} {
  const subscribeMock = vi.fn();
  const unsubscribeMock = vi.fn();

  return {
    broadcastChanged: vi.fn(),
    close: vi.fn(),
    subscribe: subscribeMock,
    subscribeMock,
    unsubscribe: unsubscribeMock,
    unsubscribeMock,
  };
}

describe('createRepoWatchManager', () => {
  it('creates one watcher per repository and reuses it for multiple streams', async () => {
    // Given
    const hub = createHub();
    const createHubMock = vi.fn(() => hub);
    const stopMock = vi.fn().mockResolvedValue(undefined);
    const createWatcherMock = vi.fn(() => ({ stop: stopMock }));
    const manager = createRepoWatchManager({
      createHub: createHubMock,
      createWatcher: createWatcherMock,
    });

    // When
    await manager.subscribe({ id: 'sift', path: '/repo/sift' }, createStream());
    await manager.subscribe({ id: 'sift', path: '/repo/sift' }, createStream());

    // Then
    expect(createHubMock).toHaveBeenCalledTimes(1);
    expect(createWatcherMock).toHaveBeenCalledTimes(1);
    expect(createWatcherMock).toHaveBeenCalledWith('/repo/sift', expect.any(Function));
    expect(hub.subscribeMock).toHaveBeenCalledTimes(2);
  });

  it('broadcasts through the repository-specific hub when the watcher changes', async () => {
    // Given
    const hub = createHub();
    let onChanged: (() => void) | null = null;
    const manager = createRepoWatchManager({
      createHub: () => hub,
      createWatcher: (_repoRoot, listener) => {
        onChanged = listener;
        return { stop: vi.fn().mockResolvedValue(undefined) };
      },
    });

    await manager.subscribe({ id: 'sift', path: '/repo/sift' }, createStream());

    // When
    onChanged?.();

    // Then
    expect(hub.broadcastChanged).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes aborted streams while keeping the watcher alive for remaining streams', async () => {
    // Given
    const hub = createHub();
    const stopMock = vi.fn().mockResolvedValue(undefined);
    const manager = createRepoWatchManager({
      createHub: () => hub,
      createWatcher: () => ({ stop: stopMock }),
    });
    const firstStream = createStream();
    const secondStream = createStream();
    await manager.subscribe({ id: 'sift', path: '/repo/sift' }, firstStream);
    await manager.subscribe({ id: 'sift', path: '/repo/sift' }, secondStream);

    // When
    await firstStream.triggerAbort();

    // Then
    expect(hub.unsubscribeMock).toHaveBeenCalledWith(firstStream);
    expect(hub.unsubscribeMock).not.toHaveBeenCalledWith(secondStream);
    expect(stopMock).not.toHaveBeenCalled();
  });

  it('stops the watcher when the last stream aborts', async () => {
    // Given
    const stopMock = vi.fn().mockResolvedValue(undefined);
    const manager = createRepoWatchManager({
      createHub,
      createWatcher: () => ({ stop: stopMock }),
    });
    const firstStream = createStream();
    const secondStream = createStream();
    await manager.subscribe({ id: 'sift', path: '/repo/sift' }, firstStream);
    await manager.subscribe({ id: 'sift', path: '/repo/sift' }, secondStream);

    // When
    await firstStream.triggerAbort();

    // Then
    expect(stopMock).not.toHaveBeenCalled();

    // When
    await secondStream.triggerAbort();

    // Then
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it('stops all active watchers when closed', async () => {
    // Given
    const stopMock = vi.fn().mockResolvedValue(undefined);
    const manager = createRepoWatchManager({
      createHub,
      createWatcher: () => ({ stop: stopMock }),
    });
    await manager.subscribe({ id: 'sift', path: '/repo/sift' }, createStream());
    await manager.subscribe({ id: 'my-app', path: '/repo/my-app' }, createStream());

    // When
    await manager.close();

    // Then
    expect(stopMock).toHaveBeenCalledTimes(2);
  });
});
