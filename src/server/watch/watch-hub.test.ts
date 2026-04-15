import { describe, expect, it, vi } from 'vitest';
import { createWatchHub, type WatchStream } from './watch-hub';

function createStream(overrides: Partial<WatchStream> = {}): WatchStream {
  let abortListener: (() => void | Promise<void>) | null = null;

  return {
    aborted: false,
    closed: false,
    onAbort: vi.fn((listener: () => void | Promise<void>) => {
      abortListener = listener;
    }),
    writeSSE: vi.fn().mockResolvedValue(undefined),
    ...overrides,
    triggerAbort: abortListener,
  } as WatchStream & { triggerAbort: (() => void | Promise<void>) | null };
}

describe('createWatchHub', () => {
  it('broadcasts change events to active clients', async () => {
    // Given: a hub with one subscribed SSE client
    const hub = createWatchHub();
    const stream = createStream();
    hub.subscribe(stream);

    // When: a repository change is broadcast
    hub.broadcastChanged();
    await Promise.resolve();

    // Then: the client receives the changed event payload
    expect(stream.writeSSE).toHaveBeenCalledWith({
      event: 'changed',
      data: 'changed',
    });
  });

  it('removes aborted clients before broadcasting', async () => {
    // Given: a subscribed client that has already been aborted
    const hub = createWatchHub();
    const stream = createStream({ aborted: true });
    hub.subscribe(stream);

    // When: a repository change is broadcast
    hub.broadcastChanged();
    await Promise.resolve();

    // Then: no write is attempted for the aborted client
    expect(stream.writeSSE).not.toHaveBeenCalled();
  });

  it('removes clients when writes fail', async () => {
    // Given: a client whose SSE write rejects
    const hub = createWatchHub();
    const stream = createStream({
      writeSSE: vi.fn().mockRejectedValue(new Error('socket closed')),
    });
    hub.subscribe(stream);

    // When: broadcasting twice
    hub.broadcastChanged();
    await Promise.resolve();
    await Promise.resolve();
    hub.broadcastChanged();
    await Promise.resolve();

    // Then: the failed client is only attempted once
    expect(stream.writeSSE).toHaveBeenCalledTimes(1);
  });
});
