import { useEffect, useRef } from 'react';

export interface UseAutoRefreshOptions {
  /**
   * Delays opening the long-lived SSE connection until the initial diff load
   * has completed. Without this gate, startup can issue `/api/diff` and
   * `/api/watch` at the same time, making the initial UI appear stuck on
   * Loading in larger repositories.
   */
  enabled?: boolean;
  /**
   * Temporarily defers auto refresh while a workspace action is running.
   * The latest repository change is replayed once the action finishes so the
   * optimistic UI update is not overwritten mid-action.
   */
  paused?: boolean;
}

export function useAutoRefresh(
  onRefresh: () => Promise<void> | void,
  { enabled = true, paused = false }: UseAutoRefreshOptions = {},
): void {
  const onRefreshRef = useRef(onRefresh);
  const pausedRef = useRef(paused);
  const pendingRefreshRef = useRef(false);

  // Keep the SSE subscription stable while still calling the latest callback
  // from App after rerenders.
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    pausedRef.current = paused;

    if (!paused && pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      void onRefreshRef.current();
    }
  }, [paused]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (typeof EventSource === 'undefined') {
      return;
    }

    const source = new EventSource('/api/watch');
    const handleChange = () => {
      if (pausedRef.current) {
        pendingRefreshRef.current = true;
        return;
      }

      void onRefreshRef.current();
    };

    source.addEventListener('changed', handleChange);
    source.onmessage = handleChange;

    return () => {
      source.close();
    };
  }, [enabled]);
}
