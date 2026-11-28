import { describe, expect, it, vi } from 'vitest';
import { createReviewPresence } from './review-presence';

function createStream(): {
  response: Response;
  ready(): void;
  end(): void;
  abort(reason: unknown): void;
} {
  let body!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      body = controller;
    },
  });
  return {
    response: new Response(stream),
    ready: () => body.enqueue(new TextEncoder().encode('ready')),
    end: () => body.close(),
    abort: (reason) => body.error(reason),
  };
}

function fetchStream(stream: ReturnType<typeof createStream>): typeof fetch {
  return async (_input, init) => {
    const signal = init?.signal;
    signal?.addEventListener('abort', () => stream.abort(signal.reason), { once: true });
    return stream.response;
  };
}

describe('review presence connection', () => {
  it('shares the pending and established connection for the same repository URL', async () => {
    // Given
    const stream = createStream();
    const fetchImpl = vi.fn(fetchStream(stream));
    const presence = createReviewPresence(fetchImpl);
    try {
      // When
      const first = presence.connect(49321, 'repo');
      const second = presence.connect(49321, 'repo');
      stream.ready();
      const [connection, sharedConnection] = await Promise.all([first, second]);

      // Then
      expect(connection).toMatchObject({ kind: 'connected', participantId: expect.any(String) });
      expect(sharedConnection).toEqual(connection);
      await expect(presence.connect(49321, 'repo')).resolves.toEqual(connection);
      expect(fetchImpl).toHaveBeenCalledOnce();
    } finally {
      presence.close();
    }
  });

  it('reports an unreachable connection if the stream ends before readiness', async () => {
    // Given
    const stream = createStream();
    const presence = createReviewPresence(fetchStream(stream));

    // When
    const connecting = presence.connect(49321, 'repo');
    stream.end();

    // Then
    await expect(connecting).resolves.toEqual({ kind: 'unreachable' });
    presence.close();
  });

  it('aborts the connection after five seconds without readiness', async () => {
    vi.useFakeTimers();
    const stream = createStream();
    const fetchImpl = vi.fn(fetchStream(stream));
    const presence = createReviewPresence(fetchImpl);
    try {
      // Given
      const connecting = presence.connect(49321, 'repo');
      const signal = fetchImpl.mock.calls[0][1]?.signal;

      // When / Then
      await vi.advanceTimersByTimeAsync(4_999);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(signal?.aborted).toBe(true);
      await expect(connecting).resolves.toEqual({ kind: 'unreachable' });
    } finally {
      presence.close();
      vi.useRealTimers();
    }
  });

  it('reopens a closed stream with the same participant ID', async () => {
    // Given
    const first = createStream();
    const second = createStream();
    const fetchImpl = vi.fn(fetchStream(second)).mockImplementationOnce(fetchStream(first));
    const presence = createReviewPresence(fetchImpl);
    try {
      first.ready();
      const connection = await presence.connect(49321, 'repo');
      const signal = fetchImpl.mock.calls[0][1]?.signal;
      const closed = new Promise<void>((resolve) =>
        signal?.addEventListener('abort', () => resolve()),
      );

      // When
      first.end();
      await closed;
      second.ready();
      const reconnected = await presence.connect(49321, 'repo');

      // Then
      expect(connection).toMatchObject({ kind: 'connected', participantId: expect.any(String) });
      expect(reconnected).toEqual(connection);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      presence.close();
    }
  });

  it('aborts an open connection and reports an unreachable connection for calls after close', async () => {
    // Given
    const stream = createStream();
    const fetchImpl = vi.fn(fetchStream(stream));
    const presence = createReviewPresence(fetchImpl);
    stream.ready();
    await presence.connect(49321, 'repo');

    // When
    presence.close();

    // Then
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await expect(presence.connect(49321, 'repo')).resolves.toEqual({ kind: 'unreachable' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('preserves the status and message when the HTTP connection is rejected', async () => {
    // Given
    const message = 'This review participant already has an open connection.';
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ error: message, code: 'REVIEW_CONFLICT' }, { status: 409 }),
      );
    const presence = createReviewPresence(fetchImpl);

    // When
    const result = await presence.connect(49321, 'repo');

    // Then
    expect(result).toEqual({ kind: 'rejected', status: 409, code: 'REVIEW_CONFLICT', message });
    presence.close();
  });
});
