import { useState, useEffect, useCallback } from 'react';
import type { DiffFile } from '../../domain/diff/types';

export function useDiffData() {
  const [workingFiles, setWorkingFiles] = useState<DiffFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiffs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/diff');
      if (!res.ok) {
        throw new Error(`Failed to fetch diff: ${res.statusText}`);
      }
      const data = await res.json();
      setWorkingFiles(data.workingFiles || []);
      setStagedFiles(data.stagedFiles || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiffs();
  }, [fetchDiffs]);

  return { workingFiles, stagedFiles, loading, error, refresh: fetchDiffs };
}
