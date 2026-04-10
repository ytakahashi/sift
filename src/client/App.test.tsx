import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../domain/diff/types';
import App from './App';
import { useDiffData } from './hooks/useDiffData';
import { useNotes } from './hooks/useNotes';
import { useWorkspaceActions } from './hooks/useWorkspaceActions';

vi.mock('./hooks/useDiffData', () => ({
  useDiffData: vi.fn(),
}));

vi.mock('./hooks/useNotes', () => ({
  useNotes: vi.fn(),
}));

vi.mock('./hooks/useWorkspaceActions', () => ({
  useWorkspaceActions: vi.fn(),
}));

vi.mock('./components/diff/UnifiedDiffViewer', () => ({
  UnifiedDiffViewer: ({ file }: { file: DiffFile }) => (
    <div data-testid="diff-viewer">{file.displayPath}</div>
  ),
}));

function createFile(id: string, bucket: 'working' | 'staged'): DiffFile {
  return {
    id,
    bucket,
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath: `${id}.ts`,
    hunks: [],
  };
}

describe('App file list interactions', () => {
  const refresh = vi.fn();
  const clearNotes = vi.fn();
  const stageFile = vi.fn(async () => {});
  const unstageFile = vi.fn(async () => {});
  let diffState: {
    workingFiles: DiffFile[];
    stagedFiles: DiffFile[];
    loading: boolean;
    error: string | null;
    refresh: typeof refresh;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    diffState = {
      workingFiles: [
        createFile('a', 'working'),
        createFile('b', 'working'),
        createFile('c', 'working'),
      ],
      stagedFiles: [createFile('s', 'staged')],
      loading: false,
      error: null,
      refresh,
    };

    vi.mocked(useDiffData).mockImplementation(() => diffState);
    vi.mocked(useNotes).mockReturnValue({
      notes: [],
      addNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      clearNotes,
    });
    vi.mocked(useWorkspaceActions).mockReturnValue({
      stageFile,
      unstageFile,
      stageHunk: vi.fn(),
      unstageHunk: vi.fn(),
      acting: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the diff on single click without activating', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('option', { name: 'b.tsM' }));
    expect(stageFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('diff-viewer').textContent).toBe('b.ts');
  });

  it('stages on double click from the working list', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('option', { name: 'b.tsM' }));
    await user.dblClick(screen.getByRole('option', { name: 'b.tsM' }));
    expect(stageFile).toHaveBeenCalledWith('b.ts');
  });

  it('unstages on Enter from the staged list', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('option', { name: 's.tsM' }));
    const stagedList = screen.getAllByRole('listbox', { name: 'Changed files' })[1];
    stagedList.focus();
    await user.keyboard('{Enter}');

    expect(unstageFile).toHaveBeenCalledWith('s.ts');
  });

  it('moves from the last working file to the first staged file with ArrowDown', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('option', { name: 'c.tsM' }));
    const workingList = screen.getAllByRole('listbox', { name: 'Changed files' })[0];
    workingList.focus();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByTestId('diff-viewer').textContent).toBe('s.ts');
  });

  it('moves from the first staged file to the last working file with ArrowUp', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('option', { name: 's.tsM' }));
    const stagedList = screen.getAllByRole('listbox', { name: 'Changed files' })[1];
    stagedList.focus();
    await user.keyboard('{ArrowUp}');

    expect(screen.getByTestId('diff-viewer').textContent).toBe('c.ts');
  });
});
