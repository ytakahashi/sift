import { useCallback, useState } from 'react';

export function useWorkspaceActions(onRefresh?: () => Promise<void> | void) {
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performAction = useCallback(
    async (endpoint: string, body: Record<string, unknown>) => {
      setActing(true);
      setError(null);
      try {
        const res = await fetch(`/api/actions/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Action failed');
        }
        if (onRefresh) {
          await onRefresh();
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setActing(false);
      }
    },
    [onRefresh],
  );

  const stageFile = useCallback(
    (path: string) => performAction('stage-file', { path }),
    [performAction],
  );
  const unstageFile = useCallback(
    (path: string) => performAction('unstage-file', { path }),
    [performAction],
  );
  const stageHunk = useCallback(
    (path: string, hunkId: string) => performAction('stage-hunk', { path, hunkId }),
    [performAction],
  );
  const unstageHunk = useCallback(
    (path: string, hunkId: string) => performAction('unstage-hunk', { path, hunkId }),
    [performAction],
  );

  return { stageFile, unstageFile, stageHunk, unstageHunk, acting, error };
}
