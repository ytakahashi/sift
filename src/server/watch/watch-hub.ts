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

export interface WatchHub {
  subscribe: (stream: WatchStream) => void;
  unsubscribe: (stream: WatchStream) => void;
  broadcastChanged: () => void;
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

  const broadcastChanged = (): void => {
    for (const stream of clients) {
      if (stream.aborted || stream.closed) {
        unsubscribe(stream);
        continue;
      }

      void stream.writeSSE({ event: 'changed', data: 'changed' }).catch(() => {
        unsubscribe(stream);
      });
    }
  };

  const close = (): void => {
    clients.clear();
  };

  return {
    subscribe,
    unsubscribe,
    broadcastChanged,
    close,
  };
}
