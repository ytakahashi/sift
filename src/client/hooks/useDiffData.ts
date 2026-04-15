import { useState, useEffect, useCallback } from 'react';
import type { DiffFile } from '../../domain/diff/types';

export function useDiffData() {
  const [workingFiles, setWorkingFiles] = useState<DiffFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiffs = useCallback(async (): Promise<{
    workingFiles: DiffFile[];
    stagedFiles: DiffFile[];
  } | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/diff');
      if (!res.ok) {
        throw new Error(`Failed to fetch diff: ${res.statusText}`);
      }
      const data = await res.json();
      const working = data.workingFiles || [];
      const staged = data.stagedFiles || [];
      setWorkingFiles(working);
      setStagedFiles(staged);
      return { workingFiles: working, stagedFiles: staged };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiffs();
  }, [fetchDiffs]);

  return { workingFiles, stagedFiles, loading, error, refresh: fetchDiffs };
}
