export interface WatchMessage {
  data: string;
  event?: string;
  id?: string;
  retry?: number;
}

export interface WatchStream {
  aborted: boolean;
  closed: boolean;
  onAbort: (listener: () => void | Promise<void>) => void;
  writeSSE: (message: WatchMessage) => Promise<unknown>;
}

/**
 * Events delivered over the per-repository SSE stream.
 * 'changed' signals a filesystem change; 'notes-changed' signals that the
 * server-side notes store was mutated (by any client, or by reconcile).
 */
export type WatchEvent = 'changed' | 'notes-changed';

export interface WatchHub {
  subscribe: (stream: WatchStream) => void;
  unsubscribe: (stream: WatchStream) => void;
  broadcast: (event: WatchEvent) => void;
  close: () => void;
}

export function createWatchHub(): WatchHub {
  const clients = new Set<WatchStream>();

  const unsubscribe = (stream: WatchStream): void => {
    clients.delete(stream);
  };

  const subscribe = (stream: WatchStream): void => {
    if (stream.aborted || stream.closed) {
      return;
    }

    clients.add(stream);
    stream.onAbort(() => {
      unsubscribe(stream);
    });
  };

  const broadcast = (event: WatchEvent): void => {
    for (const stream of clients) {
      if (stream.aborted || stream.closed) {
        unsubscribe(stream);
        continue;
      }

      void stream.writeSSE({ event, data: event }).catch(() => {
        unsubscribe(stream);
      });
    }
  };

  const close = (): void => {
    // `close()` is used during server shutdown to drop the currently connected
    // clients. The hub itself remains reusable; if something subscribes after
    // this point it will be tracked again, but the surrounding runtime is
    // expected to stop accepting requests immediately afterwards.
    clients.clear();
  };

  return {
    subscribe,
    unsubscribe,
    broadcast,
    close,
  };
}
