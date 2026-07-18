import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { FileGeneration } from '../../domain/diff/file-generation';
import type { DiffFile } from '../../domain/diff/types';
import type { Note } from '../../domain/notes/types';
import type { Env } from '../create-app';
import { NoteNotFoundError } from '../services/notes-store';
import { RepositoryNotFoundError } from '../services/repository-resolver';
import { createNotesRoutes } from './notes';

interface FileFixtureOptions {
  path: string;
  kind?: DiffFile['kind'];
  hunkId?: string;
  lines?: Array<{ line: number; content: string }>;
}

function createFile(options: FileFixtureOptions): DiffFile {
  return {
    id: `file-${options.path}`,
    bucket: 'working',
    path: options.path,
    status: 'modified',
    kind: options.kind ?? 'text',
    displayPath: options.path,
    hunks: [
      {
        id: options.hunkId ?? `hunk-${options.path}-0`,
        header: '@@ -1,1 +1,1 @@',
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: (options.lines ?? []).map(({ line, content }, index) => ({
          id: `line-${options.path}-${index}`,
          type: 'add' as const,
          newLineNumber: line,
          content,
        })),
      },
    ],
  };
}

function createStoredNote(id: string): Note {
  return {
    id,
    target: { kind: 'file', fileId: 'file-a.ts' },
    body: `note-${id}`,
    createdAt: 100,
  };
}

const FILE_GENERATION: FileGeneration = { kind: 'file', blobId: 'blob-1', mode: '100644' };

describe('notesRoutes', () => {
  let workingFiles: DiffFile[];
  let stagedFiles: DiffFile[];
  let generations: Map<string, FileGeneration>;
  let notesStore: {
    reconcile: Mock;
    list: Mock;
    add: Mock;
    updateBody: Mock;
    remove: Mock;
    clear: Mock;
  };
  let getWorktreeGenerations: Mock;
  let getFiles: Mock;
  let notifyNotesChanged: Mock;
  let app: Hono<Env>;

  beforeEach(() => {
    workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'alpha' }] })];
    stagedFiles = [];
    generations = new Map([['a.ts', FILE_GENERATION]]);

    notesStore = {
      reconcile: vi.fn().mockResolvedValue(false),
      list: vi.fn().mockResolvedValue([createStoredNote('n1')]),
      add: vi.fn().mockResolvedValue(createStoredNote('created')),
      updateBody: vi.fn().mockResolvedValue(createStoredNote('updated')),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };
    getWorktreeGenerations = vi.fn(async () => generations);
    getFiles = vi.fn(async (bucket: string) => (bucket === 'working' ? workingFiles : stagedFiles));
    notifyNotesChanged = vi.fn();

    app = new Hono<Env>();
    app.route(
      '/api',
      createNotesRoutes({
        repositoryResolver: {
          listRepositories: vi.fn(),
          resolveRepository: vi.fn(async (repoId: string) => {
            if (repoId === 'missing') {
              throw new RepositoryNotFoundError('not configured');
            }
            return { id: repoId, name: repoId, path: `/repo/${repoId}` };
          }),
        },
        notesStore,
        createDiffProvider: () => ({ getFiles }),
        createFileGenerationProvider: () => ({ getWorktreeGenerations }),
        notifyNotesChanged,
      }),
    );
  });

  async function postNote(body: unknown): Promise<Response> {
    return app.request('/api/repositories/my-repo/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  describe('reconcile preprocessing', () => {
    it('reconciles with pane diffs and generations of note-eligible paths only', async () => {
      // Given: panes contain a text file (twice, across panes) and a submodule
      workingFiles = [
        createFile({ path: 'a.ts', lines: [{ line: 5, content: 'alpha' }] }),
        createFile({ path: 'vendor/lib', kind: 'submodule' }),
      ];
      stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 1, content: 'beta' }] })];

      // When: notes are listed
      const response = await app.request('/api/repositories/my-repo/notes');

      // Then: generations are fetched once for the deduplicated eligible paths
      expect(response.status).toBe(200);
      expect(getWorktreeGenerations).toHaveBeenCalledTimes(1);
      expect(getWorktreeGenerations).toHaveBeenCalledWith(['a.ts']);

      // Then: the store reconciles against the fetched state
      expect(notesStore.reconcile).toHaveBeenCalledWith('my-repo', {
        repoId: 'my-repo',
        workingFiles,
        stagedFiles,
        generations,
      });
    });

    it('notifies subscribers when reconcile discarded or re-anchored notes', async () => {
      // Given: reconcile reports a change
      notesStore.reconcile.mockResolvedValue(true);

      // When: notes are listed (a read-only request)
      await app.request('/api/repositories/my-repo/notes');

      // Then: other clients are notified of the server-side change
      expect(notifyNotesChanged).toHaveBeenCalledWith('my-repo');
    });

    it('returns 404 for an unknown repository', async () => {
      // When: notes are listed for an unconfigured repoId
      const response = await app.request('/api/repositories/missing/notes');

      // Then: the resolver error maps to 404 with a stable classification
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        error: 'not configured',
        code: 'REPOSITORY_NOT_FOUND',
      });
    });

    it('does not reconcile when a pane diff cannot be loaded', async () => {
      // Given: Git fails while loading one of the pane diffs
      getFiles.mockRejectedValueOnce(new Error('git diff failed'));

      // When: notes are listed
      const response = await app.request('/api/repositories/my-repo/notes');

      // Then: the request fails without interpreting the missing diff as file removal
      expect(response.status).toBe(500);
      expect(notesStore.reconcile).not.toHaveBeenCalled();
      expect(notesStore.list).not.toHaveBeenCalled();
    });
  });

  describe('GET /notes', () => {
    it('returns the reconciled notes', async () => {
      // When: notes are listed
      const response = await app.request('/api/repositories/my-repo/notes');

      // Then: the store contents are returned under "notes"
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ notes: [createStoredNote('n1')] });
    });
  });

  describe('POST /notes (line note)', () => {
    it('resolves a unique target without bucket and stores the anchor', async () => {
      // When: a line note is created for the only matching pane
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 5, endLine: 5 },
        body: 'needs a guard',
      });

      // Then: the created note is returned
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toEqual(createStoredNote('created'));

      // Then: the server-resolved target and anchor are stored
      expect(notesStore.add).toHaveBeenCalledWith(
        'my-repo',
        {
          kind: 'line',
          fileId: 'file-a.ts',
          bucket: 'working',
          hunkId: 'hunk-a.ts-0',
          startNewLineNumber: 5,
          endNewLineNumber: 5,
        },
        'needs a guard',
        { generation: FILE_GENERATION, lineContents: ['alpha'] },
      );
      expect(notifyNotesChanged).toHaveBeenCalledWith('my-repo');
    });

    it('resolves a multi-line range in one hunk and stores all line contents', async () => {
      // Given: one working hunk contains the complete requested range
      workingFiles = [
        createFile({
          path: 'a.ts',
          lines: [
            { line: 5, content: 'first' },
            { line: 6, content: 'second' },
            { line: 7, content: 'third' },
          ],
        }),
      ];

      // When: a note is created for the complete range
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 5, endLine: 7 },
        body: 'review this block',
      });

      // Then: the resolved range and ordered content baseline are stored
      expect(response.status).toBe(201);
      expect(notesStore.add).toHaveBeenCalledWith(
        'my-repo',
        {
          kind: 'line',
          fileId: 'file-a.ts',
          bucket: 'working',
          hunkId: 'hunk-a.ts-0',
          startNewLineNumber: 5,
          endNewLineNumber: 7,
        },
        'review this block',
        { generation: FILE_GENERATION, lineContents: ['first', 'second', 'third'] },
      );
    });

    it('respects an explicit bucket', async () => {
      // Given: the same line exists in both panes
      stagedFiles = [
        createFile({ path: 'a.ts', hunkId: 'hunk-staged', lines: [{ line: 5, content: 'beta' }] }),
      ];

      // When: the staged pane is requested explicitly
      const response = await postNote({
        target: {
          kind: 'line',
          path: 'a.ts',
          startLine: 5,
          endLine: 5,
          bucket: 'staged',
        },
        body: 'staged side',
      });

      // Then: the staged pane is resolved without ambiguity
      expect(response.status).toBe(201);
      const target = notesStore.add.mock.calls[0][1];
      expect(target.bucket).toBe('staged');
      expect(target.hunkId).toBe('hunk-staged');
    });

    it('returns 422 with a file-note hint when the line is not in the diff', async () => {
      // When: a note targets a line outside every hunk
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 99, endLine: 99 },
        body: 'x',
      });

      // Then: the error guides the agent toward a file note
      expect(response.status).toBe(422);
      const payload = (await response.json()) as { error: string; code: string };
      expect(payload.error).toContain('kind "file"');
      expect(payload.code).toBe('NOTE_TARGET_NOT_FOUND');
      expect(notesStore.add).not.toHaveBeenCalled();
    });

    it('returns 422 when a range spans separate hunks', async () => {
      // Given: both endpoints exist, but no single hunk contains the range
      const firstFile = createFile({
        path: 'a.ts',
        hunkId: 'hunk-first',
        lines: [
          { line: 5, content: 'first' },
          { line: 6, content: 'second' },
        ],
      });
      const secondHunk = createFile({
        path: 'a.ts',
        hunkId: 'hunk-second',
        lines: [
          { line: 8, content: 'third' },
          { line: 9, content: 'fourth' },
        ],
      }).hunks[0];
      workingFiles = [{ ...firstFile, hunks: [firstFile.hunks[0], secondHunk] }];

      // When: the requested range crosses the gap between hunks
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 6, endLine: 8 },
        body: 'x',
      });

      // Then: target resolution rejects the range with a distinct hint
      expect(response.status).toBe(422);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toContain('single hunk');
      expect(payload.error).toContain('Lines 6-8');
      expect(notesStore.add).not.toHaveBeenCalled();
    });

    it('returns 422 when a line inside the requested range is absent', async () => {
      // Given: one hunk contains the endpoints but not every line between them
      workingFiles = [
        createFile({
          path: 'a.ts',
          lines: [
            { line: 5, content: 'first' },
            { line: 7, content: 'third' },
          ],
        }),
      ];

      // When: the range includes the missing line 6
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 5, endLine: 7 },
        body: 'x',
      });

      // Then: the incomplete range is rejected as a target-resolution error
      expect(response.status).toBe(422);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toContain('single hunk');
      expect(notesStore.add).not.toHaveBeenCalled();
    });

    it('returns 422 asking for a bucket when both panes match', async () => {
      // Given: the same line number exists in both panes
      stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'beta' }] })];

      // When: no bucket is specified
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 5, endLine: 5 },
        body: 'x',
      });

      // Then: the error names the required parameter
      expect(response.status).toBe(422);
      const payload = (await response.json()) as { error: string; code: string };
      expect(payload.error).toContain('"bucket"');
      expect(payload.code).toBe('NOTE_TARGET_AMBIGUOUS');
      expect(notesStore.add).not.toHaveBeenCalled();
    });

    it('returns 422 asking for a bucket when a range matches both panes', async () => {
      // Given: both panes contain the complete requested range
      workingFiles = [
        createFile({
          path: 'a.ts',
          lines: [
            { line: 5, content: 'working-first' },
            { line: 6, content: 'working-second' },
          ],
        }),
      ];
      stagedFiles = [
        createFile({
          path: 'a.ts',
          lines: [
            { line: 5, content: 'staged-first' },
            { line: 6, content: 'staged-second' },
          ],
        }),
      ];

      // When: the request omits the bucket
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 5, endLine: 6 },
        body: 'x',
      });

      // Then: the range is reported as ambiguous
      expect(response.status).toBe(422);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toContain('Lines 5-6');
      expect(payload.error).toContain('"bucket"');
      expect(notesStore.add).not.toHaveBeenCalled();
    });

    it('returns 422 when the path only matches a submodule', async () => {
      // Given: the path exists in the diff as a submodule entry
      workingFiles = [createFile({ path: 'vendor/lib', kind: 'submodule' })];

      // When: a line note targets the submodule
      const response = await postNote({
        target: { kind: 'line', path: 'vendor/lib', startLine: 1, endLine: 1 },
        body: 'x',
      });

      // Then: the error explains submodules are not note targets
      expect(response.status).toBe(422);
      const payload = (await response.json()) as { error: string; code: string };
      expect(payload.error).toContain('submodule');
      expect(payload.code).toBe('NOTE_TARGET_INELIGIBLE');
      expect(notesStore.add).not.toHaveBeenCalled();
    });

    it('uses the line-not-found hint when an eligible file and submodule share the path', async () => {
      // Given: a type transition leaves an eligible file in one pane and a
      // submodule entry at the same path in the other pane
      workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'alpha' }] })];
      stagedFiles = [createFile({ path: 'a.ts', kind: 'submodule' })];

      // When: a line absent from the eligible file is requested
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 99, endLine: 99 },
        body: 'x',
      });

      // Then: the path is not mislabeled as submodule-only, and the agent is
      // guided toward the valid file-note fallback
      expect(response.status).toBe(422);
      const payload = (await response.json()) as { error: string };
      expect(payload.error).toContain('kind "file"');
      expect(payload.error).not.toContain('is a submodule');
    });

    it('returns 503 without saving when the generation is unavailable', async () => {
      // Given: the target file's generation cannot be determined
      generations = new Map([['a.ts', { kind: 'unavailable', reason: 'read error' }]]);

      // When: a line note is created
      const response = await postNote({
        target: { kind: 'line', path: 'a.ts', startLine: 5, endLine: 5 },
        body: 'x',
      });

      // Then: the request fails as retryable and nothing is stored
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        code: 'NOTE_GENERATION_UNAVAILABLE',
      });
      expect(notesStore.add).not.toHaveBeenCalled();
    });
  });

  describe('POST /notes (file note)', () => {
    it('creates a pane-agnostic file note', async () => {
      // When: a file note is created
      const response = await postNote({
        target: { kind: 'file', path: 'a.ts' },
        body: 'about this file',
      });

      // Then: the target carries no bucket and no line content is recorded
      expect(response.status).toBe(201);
      expect(notesStore.add).toHaveBeenCalledWith(
        'my-repo',
        { kind: 'file', fileId: 'file-a.ts' },
        'about this file',
        { generation: FILE_GENERATION, lineContents: undefined },
      );
    });

    it('returns 422 when the file is not part of the diff', async () => {
      // When: a file note targets an unknown path
      const response = await postNote({
        target: { kind: 'file', path: 'unknown.ts' },
        body: 'x',
      });

      // Then: the request is rejected
      expect(response.status).toBe(422);
      expect(notesStore.add).not.toHaveBeenCalled();
    });
  });

  describe('POST /notes (request validation)', () => {
    it.each([
      ['malformed JSON', 'not-json'],
      [
        'empty body text',
        {
          target: { kind: 'line', path: 'a.ts', startLine: 5, endLine: 5 },
          body: '   ',
        },
      ],
      [
        'invalid bucket',
        {
          target: { kind: 'line', path: 'a.ts', startLine: 5, endLine: 5, bucket: 'x' },
          body: 'b',
        },
      ],
      [
        'bucket on a file note',
        { target: { kind: 'file', path: 'a.ts', bucket: 'working' }, body: 'b' },
      ],
      ['unknown target kind', { target: { kind: 'hunk', path: 'a.ts' }, body: 'b' }],
      ['missing startLine', { target: { kind: 'line', path: 'a.ts', endLine: 5 }, body: 'b' }],
      ['missing endLine', { target: { kind: 'line', path: 'a.ts', startLine: 5 }, body: 'b' }],
      ['legacy line field', { target: { kind: 'line', path: 'a.ts', line: 5 }, body: 'b' }],
      [
        'non-integer startLine',
        { target: { kind: 'line', path: 'a.ts', startLine: 1.5, endLine: 5 }, body: 'b' },
      ],
      [
        'non-integer endLine',
        { target: { kind: 'line', path: 'a.ts', startLine: 1, endLine: 1.5 }, body: 'b' },
      ],
      [
        'non-positive startLine',
        { target: { kind: 'line', path: 'a.ts', startLine: 0, endLine: 5 }, body: 'b' },
      ],
      [
        'non-positive endLine',
        { target: { kind: 'line', path: 'a.ts', startLine: 1, endLine: -1 }, body: 'b' },
      ],
      [
        'unsafe startLine',
        {
          target: { kind: 'line', path: 'a.ts', startLine: Number.MAX_VALUE, endLine: 5 },
          body: 'b',
        },
      ],
      [
        'unsafe endLine',
        {
          target: { kind: 'line', path: 'a.ts', startLine: 1, endLine: Number.MAX_VALUE },
          body: 'b',
        },
      ],
      [
        'reversed range',
        { target: { kind: 'line', path: 'a.ts', startLine: 6, endLine: 5 }, body: 'b' },
      ],
    ] as Array<[string, unknown]>)('returns 400 for %s', async (_label, body) => {
      // When: an invalid creation request arrives
      const response = await postNote(body);

      // Then: it is rejected before resolution and nothing is stored
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'NOTE_REQUEST_INVALID' });
      expect(notesStore.add).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /notes/:noteId', () => {
    it('updates the body and notifies', async () => {
      // When: a note body is updated
      const response = await app.request('/api/repositories/my-repo/notes/n1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'revised' }),
      });

      // Then: the updated note is returned and subscribers are notified
      expect(response.status).toBe(200);
      expect(notesStore.updateBody).toHaveBeenCalledWith('my-repo', 'n1', 'revised');
      expect(notifyNotesChanged).toHaveBeenCalledWith('my-repo');
    });

    it('returns 404 when the note does not exist (including reconcile discards)', async () => {
      // Given: the store no longer holds the note
      notesStore.updateBody.mockRejectedValue(new NoteNotFoundError('Note not found: n1'));

      // When: the stale note is updated
      const response = await app.request('/api/repositories/my-repo/notes/n1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'revised' }),
      });

      // Then: the typed error maps to 404
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ code: 'NOTE_NOT_FOUND' });
    });
  });

  describe('DELETE /notes/:noteId', () => {
    it('removes the note after reconciling and notifies', async () => {
      // When: a note is removed
      const response = await app.request('/api/repositories/my-repo/notes/n1', {
        method: 'DELETE',
      });

      // Then: reconcile ran first, the note is removed, subscribers notified
      expect(response.status).toBe(204);
      expect(notesStore.reconcile).toHaveBeenCalledTimes(1);
      expect(notesStore.remove).toHaveBeenCalledWith('my-repo', 'n1');
      expect(notifyNotesChanged).toHaveBeenCalledWith('my-repo');
    });
  });

  describe('DELETE /notes (clear all)', () => {
    it('clears without reconciling and notifies', async () => {
      // When: all notes are cleared explicitly
      const response = await app.request('/api/repositories/my-repo/notes', {
        method: 'DELETE',
      });

      // Then: everything is removed anyway, so reconcile is skipped
      expect(response.status).toBe(204);
      expect(notesStore.clear).toHaveBeenCalledWith('my-repo');
      expect(notesStore.reconcile).not.toHaveBeenCalled();
      expect(getWorktreeGenerations).not.toHaveBeenCalled();
      expect(notifyNotesChanged).toHaveBeenCalledWith('my-repo');
    });
  });
});
