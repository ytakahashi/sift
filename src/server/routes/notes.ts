import { Hono, type Context } from 'hono';
import type { DiffProvider } from '../../domain/diff/diff-provider';
import type { ConfirmedFileGeneration, FileGeneration } from '../../domain/diff/file-generation';
import type { DiffFile } from '../../domain/diff/types';
import type { AnchoredNoteTarget } from '../../domain/notes/anchored-note';
import { isNoteEligibleFile } from '../../domain/notes/note-eligibility';
import { resolveLineNoteTarget } from '../../domain/notes/resolve-line-note-target';
import type { NoteBucket } from '../../domain/notes/types';
import type { RepositoryId } from '../../domain/repository/repository';
import type { Env } from './env';
import type { FileGenerationProvider } from '../services/file-generation-provider';
import type { NotesStore } from '../services/notes-store';
import {
  NoteGenerationUnavailableError,
  NoteRequestValidationError,
  NoteTargetResolutionError,
} from '../services/notes-store';
import type { RepositoryResolver } from '../services/repository-resolver';
import { toNoteResponse } from './note-response';
import { handleRouteError } from './route-error';

export interface CreateNotesRoutesOptions {
  repositoryResolver: RepositoryResolver;
  notesStore: NotesStore;
  createDiffProvider: (repositoryPath: string) => DiffProvider;
  createFileGenerationProvider: (repositoryPath: string) => FileGenerationProvider;
  notifyNotesChanged: (repoId: RepositoryId) => void;
}

/** Current repository state shared between reconcile and POST target resolution. */
interface RepoNotesContext {
  repoId: RepositoryId;
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
  generations: ReadonlyMap<string, FileGeneration>;
}

type NoteCreateRequest =
  | {
      kind: 'line';
      path: string;
      startLine: number;
      endLine: number;
      bucket?: NoteBucket;
    }
  | { kind: 'file'; path: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonBody(c: Context<Env>): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch (_error: unknown) {
    throw new NoteRequestValidationError('Note request body must be a JSON object.');
  }
  if (!isRecord(body)) {
    throw new NoteRequestValidationError('Note request body must be a JSON object.');
  }
  return body;
}

function readNoteBody(body: Record<string, unknown>): string {
  const noteBody = body.body;
  if (typeof noteBody !== 'string' || noteBody.trim() === '') {
    throw new NoteRequestValidationError('Note requires a non-empty string body.');
  }
  return noteBody;
}

function readPositiveLineNumber(value: unknown, fieldName: 'startLine' | 'endLine'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new NoteRequestValidationError(
      `Line note target requires a positive integer "${fieldName}" (new-file-side line number).`,
    );
  }
  return value;
}

function readCreateTarget(body: Record<string, unknown>): NoteCreateRequest {
  const target = body.target;
  if (!isRecord(target)) {
    throw new NoteRequestValidationError('Note requires a target object.');
  }

  const path = target.path;
  if (typeof path !== 'string' || path.trim() === '') {
    throw new NoteRequestValidationError('Note target requires a non-empty string path.');
  }

  if (target.kind === 'file') {
    if (target.bucket !== undefined) {
      throw new NoteRequestValidationError(
        'File notes are pane-agnostic; "bucket" is not allowed for target kind "file".',
      );
    }
    return { kind: 'file', path };
  }

  if (target.kind === 'line') {
    const startLine = readPositiveLineNumber(target.startLine, 'startLine');
    const endLine = readPositiveLineNumber(target.endLine, 'endLine');
    if (startLine > endLine) {
      throw new NoteRequestValidationError(
        'Line note target requires "startLine" to be less than or equal to "endLine".',
      );
    }
    const bucket = target.bucket;
    if (bucket !== undefined && bucket !== 'working' && bucket !== 'staged') {
      throw new NoteRequestValidationError(
        'Line note "bucket" must be "working" or "staged" when specified.',
      );
    }
    return { kind: 'line', path, startLine, endLine, bucket };
  }

  throw new NoteRequestValidationError('Note target kind must be "line" or "file".');
}

function formatRequestedLineRange(startLine: number, endLine: number): string {
  return startLine === endLine ? `Line ${startLine}` : `Lines ${startLine}-${endLine}`;
}

function hasSubmoduleAtPath(context: RepoNotesContext, path: string): boolean {
  return [...context.workingFiles, ...context.stagedFiles].some(
    (file) => file.path === path && !isNoteEligibleFile(file),
  );
}

function hasOnlySubmoduleAtPath(context: RepoNotesContext, path: string): boolean {
  return hasSubmoduleAtPath(context, path) && findEligibleFileByPath(context, path) === null;
}

function findEligibleFileByPath(context: RepoNotesContext, path: string): DiffFile | null {
  return (
    [...context.workingFiles, ...context.stagedFiles].find(
      (file) => file.path === path && isNoteEligibleFile(file),
    ) ?? null
  );
}

/**
 * Looks up the creation-time anchor generation. Creation never stores an
 * indeterminate anchor: an unavailable (or missing) generation aborts with
 * 503 so the client can retry with the same content.
 */
function requireConfirmedGeneration(
  context: RepoNotesContext,
  path: string,
): ConfirmedFileGeneration {
  const generation = context.generations.get(path);
  if (generation === undefined || generation.kind === 'unavailable') {
    throw new NoteGenerationUnavailableError(
      `Could not determine the current state of "${path}". Retry with the same content.`,
    );
  }
  return generation;
}

function resolveCreateTarget(
  context: RepoNotesContext,
  request: NoteCreateRequest,
): { target: AnchoredNoteTarget; generation: ConfirmedFileGeneration; lineContents?: string[] } {
  if (request.kind === 'file') {
    const file = findEligibleFileByPath(context, request.path);
    if (!file) {
      if (hasOnlySubmoduleAtPath(context, request.path)) {
        throw new NoteTargetResolutionError(
          `"${request.path}" is a submodule; notes cannot be attached to submodules.`,
          'ineligible',
        );
      }
      throw new NoteTargetResolutionError(
        `"${request.path}" is not part of the current diff.`,
        'not-found',
      );
    }
    return {
      target: { kind: 'file', fileId: file.id },
      generation: requireConfirmedGeneration(context, file.path),
    };
  }

  const resolution = resolveLineNoteTarget({
    workingFiles: context.workingFiles,
    stagedFiles: context.stagedFiles,
    path: request.path,
    startLine: request.startLine,
    endLine: request.endLine,
    bucketConstraint: request.bucket ? { kind: 'only', bucket: request.bucket } : undefined,
  });

  if (resolution.kind === 'ambiguous') {
    const requestedRange = formatRequestedLineRange(request.startLine, request.endLine);
    const verb = request.startLine === request.endLine ? 'exists' : 'exist';
    throw new NoteTargetResolutionError(
      `${requestedRange} of "${request.path}" ${verb} in both the working and staged diffs. ` +
        'Specify "bucket": "working" or "staged".',
      'ambiguous',
    );
  }
  if (resolution.kind === 'not-found') {
    if (hasOnlySubmoduleAtPath(context, request.path)) {
      throw new NoteTargetResolutionError(
        `"${request.path}" is a submodule; notes cannot be attached to submodules.`,
        'ineligible',
      );
    }
    const requestedRange = formatRequestedLineRange(request.startLine, request.endLine);
    const message =
      request.startLine === request.endLine
        ? `${requestedRange} of "${request.path}" is not part of the current diff. `
        : `${requestedRange} of "${request.path}" are not fully contained in a single hunk ` +
          'of the current diff. ';
    throw new NoteTargetResolutionError(
      message + 'For a file-level comment, use target kind "file".',
      'not-found',
    );
  }

  return {
    target: {
      kind: 'line',
      fileId: resolution.target.fileId,
      bucket: resolution.target.bucket,
      hunkId: resolution.target.hunkId,
      startNewLineNumber: request.startLine,
      endNewLineNumber: request.endLine,
    },
    generation: requireConfirmedGeneration(context, request.path),
    lineContents: resolution.target.lineContents,
  };
}

export function createNotesRoutes(options: CreateNotesRoutesOptions): Hono<Env> {
  const notesRoutes = new Hono<Env>();
  const resolver = options.repositoryResolver;

  /**
   * Shared preprocessing for every handler except the explicit clear-all:
   * fetch both pane diffs, batch-fetch worktree generations for the
   * note-eligible paths, and reconcile the store so responses never expose
   * notes that are stale against the current diff.
   */
  const reconcileRepo = async (c: Context<Env>): Promise<RepoNotesContext> => {
    const repository = await resolver.resolveRepository(c.req.param('repoId') as string);
    const diffProvider = options.createDiffProvider(repository.path);
    const [workingFiles, stagedFiles] = await Promise.all([
      diffProvider.getFiles('working'),
      diffProvider.getFiles('staged'),
    ]);

    const paths = [
      ...new Set(
        [...workingFiles, ...stagedFiles].filter(isNoteEligibleFile).map((file) => file.path),
      ),
    ];
    const generations = await options
      .createFileGenerationProvider(repository.path)
      .getWorktreeGenerations(paths);

    const context: RepoNotesContext = {
      repoId: repository.id,
      workingFiles,
      stagedFiles,
      generations,
    };
    const changed = await options.notesStore.reconcile(repository.id, context);
    if (changed) {
      options.notifyNotesChanged(repository.id);
    }
    return context;
  };

  notesRoutes.get('/repositories/:repoId/notes', async (c) => {
    try {
      const context = await reconcileRepo(c);
      const notes = await options.notesStore.list(context.repoId);
      return c.json({ notes: notes.map(toNoteResponse) });
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  notesRoutes.post('/repositories/:repoId/notes', async (c) => {
    try {
      const context = await reconcileRepo(c);
      const body = await readJsonBody(c);
      const noteBody = readNoteBody(body);
      const request = readCreateTarget(body);

      const resolved = resolveCreateTarget(context, request);
      const note = await options.notesStore.add(
        context.repoId,
        // Target resolution matches paths exactly, so the requested path is
        // the resolved file's path.
        { path: request.path, target: resolved.target, body: noteBody },
        { generation: resolved.generation, lineContents: resolved.lineContents },
      );
      options.notifyNotesChanged(context.repoId);
      return c.json(toNoteResponse(note), 201);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  notesRoutes.patch('/repositories/:repoId/notes/:noteId', async (c) => {
    try {
      const context = await reconcileRepo(c);
      const body = await readJsonBody(c);
      const noteBody = readNoteBody(body);

      const note = await options.notesStore.updateBody(
        context.repoId,
        c.req.param('noteId') as string,
        noteBody,
      );
      options.notifyNotesChanged(context.repoId);
      return c.json(toNoteResponse(note));
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  notesRoutes.delete('/repositories/:repoId/notes/:noteId', async (c) => {
    try {
      const context = await reconcileRepo(c);
      await options.notesStore.remove(context.repoId, c.req.param('noteId') as string);
      options.notifyNotesChanged(context.repoId);
      return c.body(null, 204);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  notesRoutes.delete('/repositories/:repoId/notes', async (c) => {
    try {
      // The explicit clear-all skips reconcile: everything is removed anyway.
      const repository = await resolver.resolveRepository(c.req.param('repoId') as string);
      await options.notesStore.clear(repository.id);
      options.notifyNotesChanged(repository.id);
      return c.body(null, 204);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  return notesRoutes;
}
