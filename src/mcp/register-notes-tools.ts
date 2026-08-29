import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { NoteCreateTarget } from '../domain/notes/types';
import type { ResolvedRepository } from '../domain/repository/repository';
import { addNoteInputSchema, addNoteOutputSchema } from './add-note-schema';
import { deleteNoteInputSchema, deleteNoteOutputSchema } from './delete-note-schema';
import type {
  CreateNoteResult,
  DeleteNoteResult,
  GetNotesResult,
  UpdateNoteResult,
} from './notes-http-client';
import type { NotesApiCompatibility } from './notes-compatibility';
import { isLiveNote } from '../domain/notes/note-staleness';
import { listNotesInputSchema, listNotesOutputSchema } from './notes-schema';
import { updateNoteInputSchema, updateNoteOutputSchema } from './update-note-schema';
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
  updateNote: (
    port: number,
    repoId: string,
    noteId: string,
    body: string,
  ) => Promise<UpdateNoteResult>;
  deleteNote: (port: number, repoId: string, noteId: string) => Promise<DeleteNoteResult>;
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
 * Shared pre-call sequence for every tool: resolve the git root (lazily,
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
        'List review comments (Notes) for the repository. By default only notes whose ' +
        'creation-time anchors still apply to the current repository state are returned. Live ' +
        'file notes may target tracked files outside the current diff. Notes whose targets have ' +
        'since changed are marked stale and left out, with "staleCount" reporting how many. ' +
        'Call this right after editing a file to see which notes went stale, which usually means ' +
        'they are addressed. Pass includeStale: true to see them with the reason they no longer ' +
        'apply. The returned ids are what update_note and delete_note take.',
      inputSchema: listNotesInputSchema,
      outputSchema: listNotesOutputSchema,
    },
    async (args): Promise<CallToolResult> => {
      const pre = await preflight(options);
      if (!pre.ok) {
        return pre.result;
      }

      const result = await options.getNotes(pre.port, pre.repoId);
      switch (result.kind) {
        case 'success': {
          const staleCount = result.notes.filter((note) => !isLiveNote(note)).length;
          return successResult({
            notes: args.includeStale ? result.notes : result.notes.filter(isLiveNote),
            staleCount,
          });
        }
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
        "Add a review comment to a whole file or a specific diff line range. kind: 'file' accepts " +
        'a tracked file even when it is outside the current diff, or a diff-visible file. kind: ' +
        "'line' must fit within one current diff hunk. If the same line range exists in both the " +
        'working and staged panes, the call fails and asks for "bucket" to be specified.',
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

  server.registerTool(
    'update_note',
    {
      description:
        'Rewrite the body of an existing note, for example to correct or narrow a review ' +
        'comment. The body is replaced in full, so send the complete new text. Get noteId from ' +
        'list_notes: ids only live as long as the Sift server process, and a note that is gone ' +
        'reports NOTE_NOT_FOUND. Only revise notes you wrote yourself; a note may have been ' +
        'written by the person reviewing the diff.',
      inputSchema: updateNoteInputSchema,
      outputSchema: updateNoteOutputSchema,
      // Replacing the whole body converges on the same note however many times
      // it is sent, so a retry after an unclear failure is safe.
      annotations: { idempotentHint: true },
    },
    async (args): Promise<CallToolResult> => {
      const pre = await preflight(options);
      if (!pre.ok) {
        return pre.result;
      }

      const result = await options.updateNote(pre.port, pre.repoId, args.noteId, args.body);
      switch (result.kind) {
        case 'success':
          return successResult({ note: result.note });
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
    'delete_note',
    {
      description:
        'Delete a note, for example to withdraw a review comment that no longer applies. Get ' +
        'noteId from list_notes: ids only live as long as the Sift server process, and a note ' +
        'that is already gone reports NOTE_NOT_FOUND. Only delete notes you wrote yourself; a ' +
        'note may have been written by the person reviewing the diff, and deletion cannot be ' +
        'undone.',
      inputSchema: deleteNoteInputSchema,
      outputSchema: deleteNoteOutputSchema,
      annotations: { idempotentHint: true, destructiveHint: true },
    },
    async (args): Promise<CallToolResult> => {
      const pre = await preflight(options);
      if (!pre.ok) {
        return pre.result;
      }

      const result = await options.deleteNote(pre.port, pre.repoId, args.noteId);
      switch (result.kind) {
        case 'success':
          // The 204 carries no body, so the outcome is restated from the request.
          return successResult({ deleted: true, noteId: args.noteId });
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
}
