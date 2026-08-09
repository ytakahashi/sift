import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile, DiffHunk } from '../../../domain/diff/types';
import { useRefreshController } from './useRefreshController';

function createHunk(contents: string[]): DiffHunk {
  return {
    id: `hunk-${contents.join('-')}`,
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: contents.length,
    lines: [
      { id: 'delete-old', type: 'delete', oldLineNumber: 1, content: 'old' },
      ...contents.map((content, index) => ({
        id: `add-${content}`,
        type: 'add' as const,
        newLineNumber: index + 1,
        content,
      })),
    ],
  };
}

function createFile(path: string, bucket: 'working' | 'staged', contents: string[]): DiffFile {
  return {
    id: path,
    bucket,
    path,
    status: 'modified',
    kind: 'text',
    displayPath: path,
    hunks: [createHunk(contents)],
  };
}

describe('useRefreshController', () => {
  it.each([
    [
      'the diff content changed',
      { workingFiles: [createFile('a.ts', 'working', ['newer'])], stagedFiles: [] },
    ],
    [
      'content moved between panes',
      { workingFiles: [], stagedFiles: [createFile('a.ts', 'staged', ['new'])] },
    ],
    [
      'the diff comes back identical',
      { workingFiles: [createFile('a.ts', 'working', ['new'])], stagedFiles: [] },
    ],
  ])('refetches notes after a successful refresh when %s', async (_label, diff) => {
    // Given: a refresh that resolves with some diff state
    const refresh = vi.fn().mockResolvedValue(diff);
    const refetchNotes = vi.fn();
    const { result } = renderHook(() => useRefreshController({ refresh, refetchNotes }));

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then: staleness is the server's decision, so the client does not filter
    // refreshes by what it can see in the diff
    expect(refetchNotes).toHaveBeenCalledTimes(1);
  });

  it('refetches notes for an edit that only reorders the changed lines', async () => {
    // Given: the same added lines come back in a different order. Comparing the
    // diff's changed lines cannot see this (such a comparison has to sort them
    // to stay stable across hunk movement), but the server anchors notes to the
    // worktree blob id, which a reorder does change — so the notes on this file
    // have just gone stale.
    const refresh = vi.fn().mockResolvedValue({
      workingFiles: [createFile('a.ts', 'working', ['second', 'first'])],
      stagedFiles: [],
    });
    const refetchNotes = vi.fn();
    const { result } = renderHook(() => useRefreshController({ refresh, refetchNotes }));

    // When: the refresh completes
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then: the notes are refetched, so they are shown as stale instead of
    // staying live until some unrelated notes API call happens to run reconcile
    expect(refetchNotes).toHaveBeenCalledTimes(1);
  });

  it('skips the refetch when refresh fails or is superseded', async () => {
    // Given: refresh returns null
    const refresh = vi.fn().mockResolvedValue(null);
    const refetchNotes = vi.fn();
    const { result } = renderHook(() => useRefreshController({ refresh, refetchNotes }));

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then: the diff state is unknown, and server-side notes changes still
    // arrive over SSE
    expect(refetchNotes).not.toHaveBeenCalled();
  });
});
