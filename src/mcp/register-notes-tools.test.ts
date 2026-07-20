import { describe, expect, it, vi } from 'vitest';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
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
    ...overrides,
  };
}

describe('registerNotesTools', () => {
  describe('preflight (shared by both tools)', () => {
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
  });

  describe('list_notes', () => {
    it('returns notes as both content and structuredContent on success', async () => {
      // Given
      const notes = [{ id: 'n1', kind: 'file' as const, path: 'a.ts', body: 'note', createdAt: 1 }];
      const options = createOptions({
        getNotes: vi.fn().mockResolvedValue({ kind: 'success', notes }),
      });
      const { server, tools } = createFakeServer();
      registerNotesTools(server, options);

      // When
      const result = await tools.get('list_notes')!();

      // Then
      expect(options.getNotes).toHaveBeenCalledWith(49321, 'sift-repo');
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ notes });
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify({ notes }) }]);
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
