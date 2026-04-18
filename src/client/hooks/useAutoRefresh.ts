import { useEffect, useRef } from 'react';
import type { RepositoryChangeSource } from '../application/ports';

export interface UseAutoRefreshOptions {
  /**
   * Delays opening the long-lived SSE connection until the initial diff load
   * has completed. Without this gate, startup can issue the initial diff read
   * and watch subscription at the same time, making the initial UI appear stuck
   * on Loading in larger repositories.
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
  changeSource: RepositoryChangeSource,
  onRefresh: () => Promise<void> | void,
  { enabled = true, paused = false }: UseAutoRefreshOptions = {},
): void {
  const onRefreshRef = useRef(onRefresh);
  const pausedRef = useRef(paused);
  const pendingRefreshRef = useRef(false);

  // Keep the change subscription stable while still calling the latest callback
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

    const subscription = changeSource.subscribe(() => {
      if (pausedRef.current) {
        pendingRefreshRef.current = true;
        return;
      }

      void onRefreshRef.current();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [changeSource, enabled]);
}
