import { describe, expect, it, vi } from 'vitest';
import { createWatchHub, type WatchStream } from './watch-hub';

interface TestWatchStream extends WatchStream {
  triggerAbort: () => void | Promise<void>;
}

function createStream(overrides: Partial<WatchStream> = {}): TestWatchStream {
  let abortListener: (() => void | Promise<void>) | null = null;

  return {
    aborted: false,
    closed: false,
    onAbort: vi.fn((listener: () => void | Promise<void>) => {
      abortListener = listener;
    }),
    writeSSE: vi.fn().mockResolvedValue(undefined),
    ...overrides,
    triggerAbort: () => {
      if (!abortListener) {
        throw new Error('Abort listener is not registered');
      }

      return abortListener();
    },
  };
}

describe('createWatchHub', () => {
  it('broadcasts change events to active clients', async () => {
    // Given: a hub with one subscribed SSE client
    const hub = createWatchHub();
    const stream = createStream();
    hub.subscribe(stream);

    // When: a repository change is broadcast
    hub.broadcast('changed');
    await Promise.resolve();

    // Then: the client receives the changed event payload
    expect(stream.writeSSE).toHaveBeenCalledWith({
      event: 'changed',
      data: 'changed',
    });
  });

  it('broadcasts notes-changed events under their own event name', async () => {
    // Given: a hub with one subscribed SSE client
    const hub = createWatchHub();
    const stream = createStream();
    hub.subscribe(stream);

    // When: a notes change is broadcast
    hub.broadcast('notes-changed');
    await Promise.resolve();

    // Then: the client receives the event under the notes-changed name,
    // independent from filesystem 'changed' events
    expect(stream.writeSSE).toHaveBeenCalledWith({
      event: 'notes-changed',
      data: 'notes-changed',
    });
  });

  it('removes aborted clients before broadcasting', async () => {
    // Given: a subscribed client that has already been aborted
    const hub = createWatchHub();
    const stream = createStream({ aborted: true });
    hub.subscribe(stream);

    // When: a repository change is broadcast
    hub.broadcast('changed');
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
    hub.broadcast('changed');
    await Promise.resolve();
    await Promise.resolve();
    hub.broadcast('changed');
    await Promise.resolve();

    // Then: the failed client is only attempted once
    expect(stream.writeSSE).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes clients when the stream aborts', async () => {
    // Given: a subscribed client with an abort hook
    const hub = createWatchHub();
    const stream = createStream();
    hub.subscribe(stream);

    // When: the client aborts and another change is broadcast
    stream.aborted = true;
    await stream.triggerAbort();
    hub.broadcast('changed');
    await Promise.resolve();

    // Then: the aborted client is not written to again
    expect(stream.writeSSE).not.toHaveBeenCalled();
  });
});
