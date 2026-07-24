import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../diff/types';
import type { FileNote, LineNote } from './types';
import { findDiffFileForNote } from './find-diff-file-for-note';

function createDiffFile(path: string, bucket: DiffFile['bucket']): DiffFile {
  return {
    id: `file-${path}`,
    bucket,
    path,
    status: 'modified',
    kind: 'text',
    displayPath: path,
    hunks: [],
  };
}

function createLineNote(overrides?: Partial<LineNote>): LineNote {
  return {
    id: 'line-note',
    kind: 'line',
    path: 'a.ts',
    startLine: 1,
    endLine: 1,
    bucket: 'working',
    body: 'body',
    createdAt: 1,
    ...overrides,
  };
}

function createFileNote(overrides?: Partial<FileNote>): FileNote {
  return {
    id: 'file-note',
    kind: 'file',
    path: 'a.ts',
    body: 'body',
    createdAt: 1,
    ...overrides,
  };
}

describe('findDiffFileForNote', () => {
  it('resolves a working-bucket line note from the working files list', () => {
    // Given: a line note anchored to the working pane
    const workingFile = createDiffFile('a.ts', 'working');
    const note = createLineNote({ bucket: 'working' });

    // When: resolving the note's diff file
    const result = findDiffFileForNote([workingFile], [], note);

    // Then: the working file and pane are returned
    expect(result).toEqual({ file: workingFile, pane: 'working' });
  });

  it('resolves a staged-bucket line note from the staged files list', () => {
    // Given: a line note anchored to the staged pane
    const stagedFile = createDiffFile('a.ts', 'staged');
    const note = createLineNote({ bucket: 'staged' });

    // When: resolving the note's diff file
    const result = findDiffFileForNote([], [stagedFile], note);

    // Then: the staged file and pane are returned
    expect(result).toEqual({ file: stagedFile, pane: 'staged' });
  });

  it('returns null when a line note has no matching file in its bucket', () => {
    // Given: a staged-bucket note but the file only exists in working
    const workingFile = createDiffFile('a.ts', 'working');
    const note = createLineNote({ bucket: 'staged' });

    // When: resolving the note's diff file
    const result = findDiffFileForNote([workingFile], [], note);

    // Then: no match is found, since bucket search is not crossed
    expect(result).toBeNull();
  });

  it('resolves a file note from the working list when present there', () => {
    // Given: a file note whose path exists in both panes
    const workingFile = createDiffFile('a.ts', 'working');
    const stagedFile = createDiffFile('a.ts', 'staged');
    const note = createFileNote();

    // When: resolving the note's diff file
    const result = findDiffFileForNote([workingFile], [stagedFile], note);

    // Then: working is preferred over staged
    expect(result).toEqual({ file: workingFile, pane: 'working' });
  });

  it('falls back to the staged list for a file note absent from working', () => {
    // Given: a file note whose path only exists in staged
    const stagedFile = createDiffFile('a.ts', 'staged');
    const note = createFileNote();

    // When: resolving the note's diff file
    const result = findDiffFileForNote([], [stagedFile], note);

    // Then: the staged file and pane are returned
    expect(result).toEqual({ file: stagedFile, pane: 'staged' });
  });

  it('returns null when a file note matches neither pane', () => {
    // Given: a file note whose path is not present in either list
    const note = createFileNote({ path: 'missing.ts' });

    // When: resolving the note's diff file
    const result = findDiffFileForNote([createDiffFile('a.ts', 'working')], [], note);

    // Then: no match is found
    expect(result).toBeNull();
  });
});
