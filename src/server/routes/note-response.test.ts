import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
import type { AnchoredNote } from '../../domain/notes/anchored-note';
import { toNoteResponse } from './note-response';

function createFile(options: {
  path: string;
  id?: string;
  displayPath?: string;
  kind?: DiffFile['kind'];
}): DiffFile {
  return {
    id: options.id ?? `file-${options.path}`,
    bucket: 'working',
    path: options.path,
    status: 'modified',
    kind: options.kind ?? 'text',
    displayPath: options.displayPath ?? options.path,
    hunks: [],
  };
}

describe('toNoteResponse', () => {
  it('maps a line AnchoredNote to a public Note with path, range, and bucket', () => {
    // Given: a line note anchored in the working pane
    const note: AnchoredNote = {
      id: 'n1',
      target: {
        kind: 'line',
        fileId: 'file-a.ts',
        bucket: 'working',
        hunkId: 'hunk-1',
        startNewLineNumber: 10,
        endNewLineNumber: 12,
      },
      body: 'review this',
      createdAt: 100,
    };
    const context = { workingFiles: [createFile({ path: 'a.ts' })], stagedFiles: [] };

    // When: the note is converted to its public shape
    const result = toNoteResponse(note, context);

    // Then: the response carries path/startLine/endLine/bucket, no internal ids
    expect(result).toEqual({
      id: 'n1',
      kind: 'line',
      path: 'a.ts',
      startLine: 10,
      endLine: 12,
      bucket: 'working',
      body: 'review this',
      createdAt: 100,
    });
  });

  it('maps a file AnchoredNote to a public Note with only path and body', () => {
    // Given: a file-level note
    const note: AnchoredNote = {
      id: 'n2',
      target: { kind: 'file', fileId: 'file-b.ts' },
      body: 'about this file',
      createdAt: 200,
    };
    const context = { workingFiles: [createFile({ path: 'b.ts' })], stagedFiles: [] };

    // When: the note is converted
    const result = toNoteResponse(note, context);

    // Then: no bucket or line fields are present
    expect(result).toEqual({
      id: 'n2',
      kind: 'file',
      path: 'b.ts',
      body: 'about this file',
      createdAt: 200,
    });
  });

  it('resolves a line note against its own bucket even when the other pane also matches', () => {
    // Given: the same fileId exists in both panes with different paths
    const note: AnchoredNote = {
      id: 'n1',
      target: {
        kind: 'line',
        fileId: 'file-a.ts',
        bucket: 'staged',
        hunkId: 'hunk-1',
        startNewLineNumber: 1,
        endNewLineNumber: 1,
      },
      body: 'x',
      createdAt: 1,
    };
    const context = {
      workingFiles: [createFile({ path: 'a.ts', id: 'file-a.ts' })],
      stagedFiles: [createFile({ path: 'renamed-a.ts', id: 'file-a.ts' })],
    };

    // When: the note is converted
    const result = toNoteResponse(note, context);

    // Then: the stored (staged) bucket's file wins, not the working pane's
    expect(result?.path).toBe('renamed-a.ts');
  });

  it('finds a file note in either pane, working first', () => {
    // Given: a file note whose fileId only exists in the staged pane
    const note: AnchoredNote = {
      id: 'n1',
      target: { kind: 'file', fileId: 'file-c.ts' },
      body: 'x',
      createdAt: 1,
    };
    const context = { workingFiles: [], stagedFiles: [createFile({ path: 'c.ts' })] };

    // When: the note is converted
    const result = toNoteResponse(note, context);

    // Then: the staged pane's file is used
    expect(result?.path).toBe('c.ts');
  });

  it('returns null when no eligible file matches the fileId', () => {
    // Given: a note whose fileId is absent from both panes
    const note: AnchoredNote = {
      id: 'n1',
      target: { kind: 'file', fileId: 'file-missing.ts' },
      body: 'x',
      createdAt: 1,
    };
    const context = { workingFiles: [], stagedFiles: [] };

    // When: the note is converted
    const result = toNoteResponse(note, context);

    // Then: the mapper reports failure instead of leaking the internal id
    expect(result).toBeNull();
  });

  it('returns null for a line note whose bucket pane no longer has the file', () => {
    // Given: a working-bucket line note, but the file now only exists staged
    const note: AnchoredNote = {
      id: 'n1',
      target: {
        kind: 'line',
        fileId: 'file-a.ts',
        bucket: 'working',
        hunkId: 'hunk-1',
        startNewLineNumber: 1,
        endNewLineNumber: 1,
      },
      body: 'x',
      createdAt: 1,
    };
    const context = { workingFiles: [], stagedFiles: [createFile({ path: 'a.ts' })] };

    // When: the note is converted
    const result = toNoteResponse(note, context);

    // Then: the mapper does not fall back to the other pane for line notes
    expect(result).toBeNull();
  });

  it('returns null when the matching file is a submodule (not note-eligible)', () => {
    // Given: the fileId now only matches a submodule entry
    const note: AnchoredNote = {
      id: 'n1',
      target: { kind: 'file', fileId: 'file-vendor.ts' },
      body: 'x',
      createdAt: 1,
    };
    const context = {
      workingFiles: [createFile({ path: 'vendor', id: 'file-vendor.ts', kind: 'submodule' })],
      stagedFiles: [],
    };

    // When: the note is converted
    const result = toNoteResponse(note, context);

    // Then: submodules are never resolved to a public note
    expect(result).toBeNull();
  });

  it('uses the repository-relative path, not displayPath', () => {
    // Given: a file whose displayPath differs from its repository-relative path
    const note: AnchoredNote = {
      id: 'n1',
      target: { kind: 'file', fileId: 'file-a.ts' },
      body: 'x',
      createdAt: 1,
    };
    const context = {
      workingFiles: [createFile({ path: 'a.ts', displayPath: 'old-a.ts -> a.ts' })],
      stagedFiles: [],
    };

    // When: the note is converted
    const result = toNoteResponse(note, context);

    // Then: the public path matches the request-addressable path, not the display form
    expect(result?.path).toBe('a.ts');
  });
});
