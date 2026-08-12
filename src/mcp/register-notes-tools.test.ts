import { describe, expect, it, vi } from 'vitest';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { Note } from '../domain/notes/types';
import type { ResolvedRepository } from '../domain/repository/repository';
import type { RegisterNotesToolsOptions } from './register-notes-tools';
import { registerNotesTools } from './register-notes-tools';
import { UNCERTAIN_ADD_NOTE_MESSAGE } from './notes-tool-guidance';

type ToolCallback = (args?: unknown) => Promise<CallToolResult>;

function createFakeServer(): { server: McpServer; tools: Map<string, ToolCallback> } {
  const tools = new Map<string, ToolCallback>();
  const registerTool = vi.fn((name: string, _config: unknown, cb: ToolCallback) => {
    tools.set(name, cb);
  });
  return { server: { registerTool } as unknown as McpServer, tools };
}

const registeredRepo: ResolvedRepository = { id: 'sift-repo', name: 'sift', path: '/repo/sift' };

function liveNote(id: string): Note {
  return {
    id,
    kind: 'file',
    path: 'a.ts',
    body: 'note',
    createdAt: 1,
    staleness: { kind: 'live' },
  };
}

function staleNote(id: string): Note {
  return {
    ...liveNote(id),
    staleness: { kind: 'stale', reason: 'content-changed' },
  };
}

function createOptions(
  overrides: Partial<RegisterNotesToolsOptions> = {},
): RegisterNotesToolsOptions {
  return {
    repoPath: '/repo/sift',
    repoRootResolver: { resolve: vi.fn().mockReturnValue('/repo/sift') },
    findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(registeredRepo),
    resolvePort: vi.fn().mockReturnValue(49321),
    checkNotesApiCompatibility: vi.fn().mockResolvedValue({ kind: 'compatible' }),
    getNotes: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    ...overrides,
  };
}

describe('registerNotesTools', () => {
  describe('preflight (shared by every tool)', () => {
    it('short-circuits list_notes when the repo root cannot be resolved, without calling the registry or compat probe', async () => {
      // Given
      const options = createOptions({
        repoRootResolver: {
          resolve: vi.fn().mockImplementation(() => {
            throw new Error('not a git repository');
          }),
        },
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(result.isError).toBe(true);
      expect(options.findRegisteredRepositoryByPath).not.toHaveBeenCalled();
      expect(options.checkNotesApiCompatibility).not.toHaveBeenCalled();
      expect(options.getNotes).not.toHaveBeenCalled();
    });

    it('short-circuits list_notes with unregistered-repo guidance when the repo is not registered', async () => {
      // Given
      const options = createOptions({
        findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(null),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringContaining('sift add /repo/sift') as unknown as string },
      ]);
      expect(options.checkNotesApiCompatibility).not.toHaveBeenCalled();
      expect(options.getNotes).not.toHaveBeenCalled();
    });

    it('returns actionable guidance when the repository configuration cannot be read', async () => {
      // Given
      const options = createOptions({
        findRegisteredRepositoryByPath: vi.fn().mockRejectedValue(new Error('invalid JSON')),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringContaining('invalid JSON') as unknown as string },
      ]);
      expect(options.resolvePort).not.toHaveBeenCalled();
      expect(options.checkNotesApiCompatibility).not.toHaveBeenCalled();
    });

    it('returns actionable guidance when PORT is invalid', async () => {
      // Given
      const options = createOptions({
        resolvePort: vi.fn().mockImplementation(() => {
          throw new Error('Invalid PORT environment variable');
        }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining('Invalid PORT environment variable') as unknown as string,
        },
      ]);
      expect(options.checkNotesApiCompatibility).not.toHaveBeenCalled();
    });

    it.each([
      ['unreachable' as const],
      ['incompatible-product' as const],
      ['capability-missing' as const],
    ])(
      'short-circuits list_notes with compatibility guidance for %s, without calling the Notes API',
      async (kind) => {
        // Given
        const options = createOptions({
          checkNotesApiCompatibility: vi.fn().mockResolvedValue({ kind }),
        });
        const { server, tools } = createFakeServer();
        registerNotesTools(server, options);

        // When
        const result = await tools.get('list_notes')!();

        // Then
        expect(result.isError).toBe(true);
        expect(options.getNotes).not.toHaveBeenCalled();
      },
    );

    it('also short-circuits add_note through the same preflight', async () => {
      // Given
      const options = createOptions({
        findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(null),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('add_note')!({ kind: 'file', path: 'a.ts', body: 'x' });

      // Then
      expect(result.isError).toBe(true);
      expect(options.createNote).not.toHaveBeenCalled();
    });

    it.each([
      ['update_note' as const, { noteId: 'n1', body: 'x' }, 'updateNote' as const],
      ['delete_note' as const, { noteId: 'n1' }, 'deleteNote' as const],
    ])('also short-circuits %s through the same preflight', async (toolName, args, clientCall) => {
      // Given
      const options = createOptions({
        findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(null),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get(toolName)!(args);

      // Then
      expect(result.isError).toBe(true);
      expect(options[clientCall]).not.toHaveBeenCalled();
    });
  });

  describe('list_notes', () => {
    it('returns notes as both content and structuredContent on success', async () => {
      // Given
      const notes = [liveNote('n1')];
      const options = createOptions({
        getNotes: vi.fn().mockResolvedValue({ kind: 'success', notes }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!({});

      // Then
      const payload = { notes, staleCount: 0 };
      expect(options.getNotes).toHaveBeenCalledWith(49321, 'sift-repo');
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual(payload);
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(payload) }]);
    });

    it('omits stale notes by default but reports how many were left out', async () => {
      // Given: one note that still applies and one that no longer does
      const options = createOptions({
        getNotes: vi
          .fn()
          .mockResolvedValue({ kind: 'success', notes: [liveNote('n1'), staleNote('n2')] }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When: the tool is called without arguments
      const result = await tools.get('list_notes')!({});

      // Then: the agent sees only actionable notes, and that something was hidden
      expect(result.structuredContent).toEqual({ notes: [liveNote('n1')], staleCount: 1 });
    });

    it('includes stale notes when asked', async () => {
      // Given: the same mix of notes
      const notes = [liveNote('n1'), staleNote('n2')];
      const options = createOptions({
        getNotes: vi.fn().mockResolvedValue({ kind: 'success', notes }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When: the caller opts in
      const result = await tools.get('list_notes')!({ includeStale: true });

      // Then: everything is returned, still with the count
      expect(result.structuredContent).toEqual({ notes, staleCount: 1 });
    });

    it('returns an actionable error for a known http-error code', async () => {
      // Given
      const options = createOptions({
        getNotes: vi.fn().mockResolvedValue({
          kind: 'http-error',
          status: 422,
          code: 'NOTE_TARGET_AMBIGUOUS',
          message: 'ambiguous target',
        }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringContaining('ambiguous target') as unknown as string },
      ]);
    });

    it('returns invalid-response guidance for a malformed response', async () => {
      // Given
      const options = createOptions({
        getNotes: vi.fn().mockResolvedValue({ kind: 'invalid-response' }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(result.isError).toBe(true);
    });

    it('returns update-or-restart guidance for a malformed non-2xx response', async () => {
      // Given
      const options = createOptions({
        getNotes: vi.fn().mockResolvedValue({ kind: 'invalid-error-response' }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringMatching(/update|restart/i) as unknown as string },
      ]);
    });

    it('returns unreachable guidance when the request fails after preflight said compatible', async () => {
      // Given
      const options = createOptions({
        getNotes: vi.fn().mockResolvedValue({ kind: 'network-error' }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(result.isError).toBe(true);
    });
  });

  describe('add_note', () => {
    it('splits target and body, and returns the created note as structuredContent on success', async () => {
      // Given
      const note = {
        id: 'n1',
        kind: 'line' as const,
        path: 'a.ts',
        startLine: 1,
        endLine: 2,
        bucket: 'working' as const,
        body: 'a note',
        createdAt: 1,
      };
      const options = createOptions({
        createNote: vi.fn().mockResolvedValue({ kind: 'success', note }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('add_note')!({
        kind: 'line',
        path: 'a.ts',
        startLine: 1,
        endLine: 2,
        body: 'a note',
      });

      // Then
      expect(options.createNote).toHaveBeenCalledWith(
        49321,
        'sift-repo',
        { kind: 'line', path: 'a.ts', startLine: 1, endLine: 2 },
        'a note',
      );
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ note });
    });

    it('returns an actionable error for a known error code', async () => {
      // Given
      const options = createOptions({
        createNote: vi.fn().mockResolvedValue({
          kind: 'known-error',
          status: 422,
          code: 'NOTE_TARGET_INELIGIBLE',
          message: 'submodule',
        }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('add_note')!({ kind: 'file', path: 'a.ts', body: 'x' });

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringContaining('submodule') as unknown as string },
      ]);
    });

    it('returns the at-least-once guidance verbatim when the outcome is uncertain', async () => {
      // Given
      const options = createOptions({
        createNote: vi.fn().mockResolvedValue({ kind: 'uncertain' }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('add_note')!({ kind: 'file', path: 'a.ts', body: 'x' });

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: UNCERTAIN_ADD_NOTE_MESSAGE }]);
    });

    it('returns update-or-restart guidance for a malformed non-2xx response', async () => {
      // Given
      const options = createOptions({
        createNote: vi.fn().mockResolvedValue({ kind: 'invalid-error-response' }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('add_note')!({ kind: 'file', path: 'a.ts', body: 'x' });

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringMatching(/update|restart/i) as unknown as string },
      ]);
    });
  });

  describe('update_note', () => {
    it('returns the updated note as structuredContent on success', async () => {
      // Given
      const note = { ...liveNote('n1'), body: 'revised' };
      const options = createOptions({
        updateNote: vi.fn().mockResolvedValue({ kind: 'success', note }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('update_note')!({ noteId: 'n1', body: 'revised' });

      // Then
      expect(options.updateNote).toHaveBeenCalledWith(49321, 'sift-repo', 'n1', 'revised');
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ note });
    });

    it('points at list_notes when the note id is unknown to the server', async () => {
      // Given
      const options = createOptions({
        updateNote: vi.fn().mockResolvedValue({
          kind: 'http-error',
          status: 404,
          code: 'NOTE_NOT_FOUND',
          message: 'Note not found: n1',
        }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('update_note')!({ noteId: 'n1', body: 'revised' });

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringContaining('list_notes') as unknown as string },
      ]);
    });

    it.each([['invalid-response' as const], ['invalid-error-response' as const]])(
      'returns update-or-restart guidance for %s',
      async (kind) => {
        // Given
        const options = createOptions({ updateNote: vi.fn().mockResolvedValue({ kind }) });
        const { server, tools } = createFakeServer();
        registerNotesTools(server, options);

        // When
        const result = await tools.get('update_note')!({ noteId: 'n1', body: 'revised' });

        // Then
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
          { type: 'text', text: expect.stringMatching(/update|restart/i) as unknown as string },
        ]);
      },
    );

    it('returns unreachable guidance when the request fails after preflight said compatible', async () => {
      // Given
      const options = createOptions({
        updateNote: vi.fn().mockResolvedValue({ kind: 'network-error' }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('update_note')!({ noteId: 'n1', body: 'revised' });

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringMatching(/sift open|sift serve/i) as unknown as string },
      ]);
    });
  });

  describe('delete_note', () => {
    it('reports the deletion with the requested id, which the 204 response cannot carry', async () => {
      // Given
      const options = createOptions({
        deleteNote: vi.fn().mockResolvedValue({ kind: 'success' }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('delete_note')!({ noteId: 'n1' });

      // Then
      expect(options.deleteNote).toHaveBeenCalledWith(49321, 'sift-repo', 'n1');
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ deleted: true, noteId: 'n1' });
    });

    it('reports an already-deleted note as an error pointing at list_notes', async () => {
      // Given
      const options = createOptions({
        deleteNote: vi.fn().mockResolvedValue({
          kind: 'http-error',
          status: 404,
          code: 'NOTE_NOT_FOUND',
          message: 'Note not found: n1',
        }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('delete_note')!({ noteId: 'n1' });

      // Then
      // Not folded into success: a 404 is indistinguishable from a wrong id.
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringContaining('list_notes') as unknown as string },
      ]);
    });

    it.each([['invalid-response' as const], ['invalid-error-response' as const]])(
      'returns update-or-restart guidance for %s',
      async (kind) => {
        // Given
        const options = createOptions({ deleteNote: vi.fn().mockResolvedValue({ kind }) });
        const { server, tools } = createFakeServer();
        registerNotesTools(server, options);

        // When
        const result = await tools.get('delete_note')!({ noteId: 'n1' });

        // Then
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
          { type: 'text', text: expect.stringMatching(/update|restart/i) as unknown as string },
        ]);
      },
    );

    it('returns unreachable guidance when the request fails after preflight said compatible', async () => {
      // Given
      const options = createOptions({
        deleteNote: vi.fn().mockResolvedValue({ kind: 'network-error' }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('delete_note')!({ noteId: 'n1' });

      // Then
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: 'text', text: expect.stringMatching(/sift open|sift serve/i) as unknown as string },
      ]);
    });
  });

  describe('tool registration shape', () => {
    it('declares idempotentHint: false for add_note', () => {
      // Given
      const options = createOptions();
      const registerTool = vi.fn();
      const server = { registerTool } as unknown as McpServer;

      // When
      registerNotesTools(server, options);

      // Then
      const addNoteCall = registerTool.mock.calls.find(([name]) => name === 'add_note');
      expect(addNoteCall?.[1]).toMatchObject({ annotations: { idempotentHint: false } });
    });

    it('declares idempotentHint: true for update_note (a full-body replace converges)', () => {
      // Given
      const options = createOptions();
      const registerTool = vi.fn();
      const server = { registerTool } as unknown as McpServer;

      // When
      registerNotesTools(server, options);

      // Then
      const updateNoteCall = registerTool.mock.calls.find(([name]) => name === 'update_note');
      expect(updateNoteCall?.[1]).toMatchObject({ annotations: { idempotentHint: true } });
    });

    it('declares delete_note as idempotent and destructive', () => {
      // Given
      const options = createOptions();
      const registerTool = vi.fn();
      const server = { registerTool } as unknown as McpServer;

      // When
      registerNotesTools(server, options);

      // Then
      const deleteNoteCall = registerTool.mock.calls.find(([name]) => name === 'delete_note');
      expect(deleteNoteCall?.[1]).toMatchObject({
        annotations: { idempotentHint: true, destructiveHint: true },
      });
    });

    it('does not set readOnlyHint for list_notes (reconcile can have side effects)', () => {
      // Given
      const options = createOptions();
      const registerTool = vi.fn();
      const server = { registerTool } as unknown as McpServer;

      // When
      registerNotesTools(server, options);

      // Then
      const listNotesCall = registerTool.mock.calls.find(([name]) => name === 'list_notes');
      const config = listNotesCall?.[1] as { annotations?: { readOnlyHint?: boolean } };
      expect(config.annotations?.readOnlyHint).toBeUndefined();
    });

    it('declares a strict empty input schema for list_notes', () => {
      // Given
      const options = createOptions();
      const registerTool = vi.fn();
      const server = { registerTool } as unknown as McpServer;

      // When
      registerNotesTools(server, options);

      // Then
      const listNotesCall = registerTool.mock.calls.find(([name]) => name === 'list_notes');
      const config = listNotesCall?.[1] as {
        inputSchema?: { safeParse: (candidate: unknown) => { success: boolean } };
      };
      expect(config.inputSchema?.safeParse({}).success).toBe(true);
      expect(config.inputSchema?.safeParse({ extra: true }).success).toBe(false);
    });
  });
});
