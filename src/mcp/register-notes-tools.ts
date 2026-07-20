import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { NoteCreateTarget } from '../domain/notes/types';
import type { ResolvedRepository } from '../domain/repository/repository';
import { addNoteInputSchema, addNoteOutputSchema } from './add-note-schema';
import type { CreateNoteResult, GetNotesResult } from './notes-http-client';
import type { NotesApiCompatibility } from './notes-compatibility';
import { listNotesInputSchema, notesListResponseSchema } from './notes-schema';
import type { RepoRootResolver } from './repo-target';
import {
  describeCapabilityMissing,
  describeIncompatibleProduct,
  describeInvalidResponse,
  describeKnownError,
  describePortResolutionFailure,
  describeRepoRootResolutionFailure,
  describeRepositoryLookupFailure,
  describeUnreachable,
  describeUnregisteredRepository,
  UNCERTAIN_ADD_NOTE_MESSAGE,
} from './notes-tool-guidance';

export interface RegisterNotesToolsOptions {
  /** The `--repo`/cwd candidate path `repoRootResolver` resolves, for error messages only. */
  repoPath: string;
  repoRootResolver: RepoRootResolver;
  findRegisteredRepositoryByPath: (path: string) => Promise<ResolvedRepository | null>;
  resolvePort: () => number;
  checkNotesApiCompatibility: (port: number) => Promise<NotesApiCompatibility>;
  getNotes: (port: number, repoId: string) => Promise<GetNotesResult>;
  createNote: (
    port: number,
    repoId: string,
    target: NoteCreateTarget,
    body: string,
  ) => Promise<CreateNoteResult>;
}

function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

function successResult(structuredContent: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}

function describeIncompatibility(
  compat: Exclude<NotesApiCompatibility, { kind: 'compatible' }>,
): string {
  switch (compat.kind) {
    case 'unreachable':
      return describeUnreachable();
    case 'incompatible-product':
      return describeIncompatibleProduct();
    case 'capability-missing':
      return describeCapabilityMissing();
  }
}

type Preflight = { ok: true; repoId: string; port: number } | { ok: false; result: CallToolResult };

/**
 * Shared pre-call sequence for both tools: resolve the git root (lazily,
 * cached after the first success), look up the repoId fresh on every call
 * (never cached; a `sift add` after this process started must take effect
 * without a restart), and probe server compatibility before ever touching
 * the Notes API.
 */
async function preflight(options: RegisterNotesToolsOptions): Promise<Preflight> {
  let repoRoot: string;
  try {
    repoRoot = options.repoRootResolver.resolve();
  } catch (error: unknown) {
    return {
      ok: false,
      result: errorResult(describeRepoRootResolutionFailure(options.repoPath, error)),
    };
  }

  let registered: ResolvedRepository | null;
  try {
    registered = await options.findRegisteredRepositoryByPath(repoRoot);
  } catch (error: unknown) {
    return {
      ok: false,
      result: errorResult(describeRepositoryLookupFailure(error)),
    };
  }
  if (!registered) {
    return { ok: false, result: errorResult(describeUnregisteredRepository(repoRoot)) };
  }

  let port: number;
  try {
    port = options.resolvePort();
  } catch (error: unknown) {
    return {
      ok: false,
      result: errorResult(describePortResolutionFailure(error)),
    };
  }
  const compat = await options.checkNotesApiCompatibility(port);
  if (compat.kind !== 'compatible') {
    return { ok: false, result: errorResult(describeIncompatibility(compat)) };
  }

  return { ok: true, repoId: registered.id, port };
}

export function registerNotesTools(server: McpServer, options: RegisterNotesToolsOptions): void {
  server.registerTool(
    'list_notes',
    {
      description:
        'List unresolved review comments (Notes) for the current diff. Call this right after ' +
        'editing a file to see which notes were automatically cleared because they are now ' +
        'considered addressed.',
      inputSchema: listNotesInputSchema,
      outputSchema: notesListResponseSchema,
    },
    async (): Promise<CallToolResult> => {
      const pre = await preflight(options);
      if (!pre.ok) {
        return pre.result;
      }

      const result = await options.getNotes(pre.port, pre.repoId);
      switch (result.kind) {
        case 'success':
          return successResult({ notes: result.notes });
        case 'http-error':
          return errorResult(describeKnownError(result.code, result.message, result.status));
        case 'invalid-response':
        case 'invalid-error-response':
          return errorResult(describeInvalidResponse());
        case 'network-error':
          return errorResult(describeUnreachable());
      }
    },
  );

  server.registerTool(
    'add_note',
    {
      description:
        "Add a review comment to a file, or to a specific line range, in the diff. kind: 'file' " +
        'comments on the whole file. If the same path/range exists in both the working and staged ' +
        'panes, the call fails and asks for "bucket" to be specified.',
      inputSchema: addNoteInputSchema,
      outputSchema: addNoteOutputSchema,
      annotations: { idempotentHint: false },
    },
    async (args): Promise<CallToolResult> => {
      const pre = await preflight(options);
      if (!pre.ok) {
        return pre.result;
      }

      const { body, ...target } = args;
      const result = await options.createNote(pre.port, pre.repoId, target, body);
      switch (result.kind) {
        case 'success':
          return successResult({ note: result.note });
        case 'known-error':
          return errorResult(describeKnownError(result.code, result.message, result.status));
        case 'invalid-error-response':
          return errorResult(describeInvalidResponse());
        case 'uncertain':
          return errorResult(UNCERTAIN_ADD_NOTE_MESSAGE);
      }
    },
  );
}
