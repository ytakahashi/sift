import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiffFile, DiffHunk, DiffLine } from '../../../domain/diff/types';
import { DiffFilesLineStats, DiffLineStats } from './DiffLineStats';

function createLine(type: DiffLine['type'], id: string): DiffLine {
  return {
    id,
    type,
    content: id,
  };
}

function createHunk(lines: DiffLine[]): DiffHunk {
  return {
    id: 'hunk-1',
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines,
  };
}

function createFile(lines: DiffLine[]): DiffFile {
  return {
    id: 'file-src-example-ts',
    bucket: 'working',
    path: 'src/example.ts',
    status: 'modified',
    kind: 'text',
    displayPath: 'src/example.ts',
    hunks: lines.length > 0 ? [createHunk(lines)] : [],
  };
}

describe('DiffLineStats', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders additions and deletions with an accessible label', () => {
    // Given: a file has added and deleted lines
    render(
      <DiffLineStats
        file={createFile([
          createLine('add', 'add-1'),
          createLine('add', 'add-2'),
          createLine('delete', 'delete-1'),
        ])}
      />,
    );

    // When / Then
    expect(screen.getByLabelText('2 additions, 1 deletion')).not.toBeNull();
    expect(screen.getByText('+2').className).toBe('diff-line-stats-add');
    expect(screen.getByText('-1').className).toBe('diff-line-stats-delete');
  });

  it('renders only additions when there are no deletions', () => {
    // Given: a file only has additions
    render(<DiffLineStats file={createFile([createLine('add', 'add-1')])} />);

    // When / Then
    expect(screen.getByLabelText('1 addition, 0 deletions')).not.toBeNull();
    expect(screen.getByText('+1')).not.toBeNull();
    expect(screen.queryByText(/-/)).toBeNull();
  });

  it('renders only deletions when there are no additions', () => {
    // Given: a file only has deletions
    render(<DiffLineStats file={createFile([createLine('delete', 'delete-1')])} />);

    // When / Then
    expect(screen.getByLabelText('0 additions, 1 deletion')).not.toBeNull();
    expect(screen.getByText('-1')).not.toBeNull();
    expect(screen.queryByText(/\+/)).toBeNull();
  });

  it('renders nothing for files without changed lines', () => {
    // Given: a file has no additions or deletions
    const { container } = render(<DiffLineStats file={createFile([])} />);

    // When / Then
    expect(container.textContent).toBe('');
  });
});

describe('DiffFilesLineStats', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders aggregate additions and deletions for multiple files', () => {
    // Given: a pane contains multiple changed files
    render(
      <DiffFilesLineStats
        files={[
          createFile([createLine('add', 'add-1'), createLine('delete', 'delete-1')]),
          createFile([createLine('add', 'add-2'), createLine('add', 'add-3')]),
          createFile([]),
        ]}
      />,
    );

    // When / Then
    expect(screen.getByLabelText('3 additions, 1 deletion')).not.toBeNull();
    expect(screen.getByText('+3')).not.toBeNull();
    expect(screen.getByText('-1')).not.toBeNull();
  });

  it('renders nothing for file lists without changed lines', () => {
    // Given: a pane has no text line changes
    const { container } = render(<DiffFilesLineStats files={[createFile([])]} />);

    // When / Then
    expect(container.textContent).toBe('');
  });
});
