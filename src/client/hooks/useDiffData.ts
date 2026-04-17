import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiffFile } from '../../domain/diff/types';

export interface DiffDataRefreshResult {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
}

// React StrictMode mounts effects twice in development. Share an in-flight
// `/api/diff` request across hook instances so startup does not run duplicate
// expensive diff generation on the server.
let inFlightDiffRequest: Promise<DiffDataRefreshResult> | null = null;

async function fetchDiffPayload(): Promise<DiffDataRefreshResult> {
  const res = await fetch('/api/diff');
  if (!res.ok) {
    throw new Error(`Failed to fetch diff: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    workingFiles: data.workingFiles || [],
    stagedFiles: data.stagedFiles || [],
  };
}

function fetchDiffPayloadOnce(): Promise<DiffDataRefreshResult> {
  inFlightDiffRequest ??= fetchDiffPayload().finally(() => {
    inFlightDiffRequest = null;
  });

  return inFlightDiffRequest;
}

export function useDiffData() {
  const [workingFiles, setWorkingFiles] = useState<DiffFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the latest caller may commit state. This prevents a slower earlier
  // refresh from overwriting newer diff data when manual refresh, action refresh,
  // and auto refresh overlap.
  const latestRequestId = useRef(0);

  const fetchDiffs = useCallback(async (): Promise<DiffDataRefreshResult | null> => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchDiffPayloadOnce();

      if (requestId !== latestRequestId.current) {
        return null;
      }

      setWorkingFiles(result.workingFiles);
      setStagedFiles(result.stagedFiles);
      return result;
    } catch (err: unknown) {
      if (requestId === latestRequestId.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDiffs();
  }, [fetchDiffs]);

  return { workingFiles, stagedFiles, loading, error, refresh: fetchDiffs };
}
