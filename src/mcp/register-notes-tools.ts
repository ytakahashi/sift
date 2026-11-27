import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { NoteCreateTarget } from '../domain/notes/types';
import { addNoteInputSchema, addNoteOutputSchema } from './add-note-schema';
import { deleteNoteInputSchema, deleteNoteOutputSchema } from './delete-note-schema';
import type {
  CreateNoteResult,
  DeleteNoteResult,
  GetNotesResult,
  UpdateNoteResult,
} from './notes-http-client';
import { isLiveNote } from '../domain/notes/note-staleness';
import { listNotesInputSchema, listNotesOutputSchema } from './notes-schema';
import { updateNoteInputSchema, updateNoteOutputSchema } from './update-note-schema';
import type { ResolveToolTarget } from './tool-target';
import { errorResult, httpErrorResult, successResult } from './notes-tool-results';
import {
  describeInvalidResponse,
  describeKnownError,
  describeUnreachable,
  UNCERTAIN_ADD_NOTE_MESSAGE,
} from './notes-tool-guidance';

export interface RegisterNotesToolsOptions {
  getNotes: (port: number, repoId: string, reviewId?: string) => Promise<GetNotesResult>;
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

export function registerNotesTools(
  server: McpServer,
  options: RegisterNotesToolsOptions,
  resolveTarget: ResolveToolTarget,
): void {
  server.registerTool(
    'list_notes',
    {
      description:
        'List review comments (Notes) for the repository. By default only notes whose ' +
        'creation-time anchors still apply to the current repository state are returned. Live ' +
        'file notes may target tracked files outside the current diff. Notes whose targets have ' +
        'since changed are marked stale and left out, with "staleCount" reporting how many. ' +
        'Pass includeStale: true to see them with the reason they no longer apply. ' +
        'Pass reviewId to get every thread in that review, including stale and resolved threads. ' +
        'Staleness describes the anchor; review thread status describes resolution. ' +
        'Use the returned note IDs with update_note and delete_note.',
      inputSchema: listNotesInputSchema,
      outputSchema: listNotesOutputSchema,
    },
    async (args): Promise<CallToolResult> => {
      const pre = await resolveTarget();
      if (!pre.ok) {
        return pre.result;
      }

      const result = await options.getNotes(pre.port, pre.repoId, args.reviewId);
      switch (result.kind) {
        case 'success': {
          const staleCount = result.notes.filter((note) => !isLiveNote(note)).length;
          return successResult({
            notes:
              args.reviewId !== undefined || args.includeStale
                ? result.notes
                : result.notes.filter(isLiveNote),
            staleCount,
          });
        }
        case 'http-error':
          return httpErrorResult(result);
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
        "Add a standalone note to a whole file or a specific diff line range. kind: 'file' accepts " +
        'a tracked file even when it is outside the current diff, or a diff-visible file. kind: ' +
        "'line' must fit within one current diff hunk. If the same line range exists in both the " +
        'working and staged panes, the call fails and asks for "bucket" to be specified. ' +
        'To open a thread in a review session, include it in submit_review.',
      inputSchema: addNoteInputSchema,
      outputSchema: addNoteOutputSchema,
      annotations: { idempotentHint: false },
    },
    async (args): Promise<CallToolResult> => {
      const pre = await resolveTarget();
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
      const pre = await resolveTarget();
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
        'undone. Threads in the current active or paused review are protected. Use submit_review ' +
        'with action "resolve" to close a thread in that review.',
      inputSchema: deleteNoteInputSchema,
      outputSchema: deleteNoteOutputSchema,
      annotations: { idempotentHint: true, destructiveHint: true },
    },
    async (args): Promise<CallToolResult> => {
      const pre = await resolveTarget();
      if (!pre.ok) {
        return pre.result;
      }

      const result = await options.deleteNote(pre.port, pre.repoId, args.noteId);
      switch (result.kind) {
        case 'success':
          // The 204 carries no body, so the outcome is restated from the request.
          return successResult({ deleted: true, noteId: args.noteId });
        case 'http-error':
          return httpErrorResult(result);
        case 'invalid-response':
        case 'invalid-error-response':
          return errorResult(describeInvalidResponse());
        case 'network-error':
          return errorResult(describeUnreachable());
      }
    },
  );
}
