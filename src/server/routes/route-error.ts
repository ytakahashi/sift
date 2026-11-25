import type { Context } from 'hono';
import type { Env } from './env';
import {
  NoteGenerationUnavailableError,
  NoteNotFoundError,
  NoteRequestValidationError,
  NoteTargetResolutionError,
} from '../services/notes-store';
import { RepositoryConfigUpdateError } from '../services/repository-config';
import {
  RepositoryConfigResolutionError,
  RepositoryNotFoundError,
  RepositoryValidationError,
} from '../services/repository-resolver';
import type { ErrorResponseCode } from '../contract/error-codes';
import { DirectoryBrowseError } from '../services/directory-browser';
import { ReviewConflict } from '../../domain/notes/review-session';
import { ReviewCommentError } from './review-request';

function noteTargetResolutionCode(kind: NoteTargetResolutionError['kind']): ErrorResponseCode {
  switch (kind) {
    case 'not-found':
      return 'NOTE_TARGET_NOT_FOUND';
    case 'ineligible':
      return 'NOTE_TARGET_INELIGIBLE';
    case 'ambiguous':
      return 'NOTE_TARGET_AMBIGUOUS';
    default: {
      // Compile-time exhaustiveness check: adding a new NoteTargetResolutionKind
      // without a case here fails the build instead of silently returning
      // `code: undefined`.
      const unhandledKind: never = kind;
      throw new Error(`Unhandled NoteTargetResolutionError kind: ${String(unhandledKind)}`);
    }
  }
}

export function handleRouteError(c: Context<Env>, error: unknown): Response {
  const details =
    error instanceof ReviewCommentError
      ? { error: error.message, commentIndex: error.index }
      : { error: error instanceof Error ? error.message : String(error) };
  if (error instanceof ReviewCommentError) {
    error = error.cause;
  }
  if (error instanceof ReviewConflict) {
    return c.json({ ...details, code: 'REVIEW_CONFLICT', noteIds: error.noteIds }, 409);
  }
  if (error instanceof DirectoryBrowseError) {
    return c.json({ error: error.message }, error.statusCode);
  }
  if (error instanceof RepositoryConfigResolutionError) {
    return c.json({ error: error.message }, error.kind === 'missing' ? 404 : 400);
  }
  if (error instanceof RepositoryNotFoundError) {
    return c.json({ error: error.message, code: 'REPOSITORY_NOT_FOUND' }, 404);
  }
  if (error instanceof RepositoryValidationError) {
    return c.json({ error: error.message, code: 'REPOSITORY_INVALID' }, 422);
  }

  if (error instanceof RepositoryConfigUpdateError) {
    return c.json({ error: error.message }, error.statusCode);
  }

  if (error instanceof NoteNotFoundError) {
    return c.json({ error: error.message, code: 'NOTE_NOT_FOUND' }, 404);
  }
  if (error instanceof NoteRequestValidationError) {
    return c.json({ ...details, code: 'NOTE_REQUEST_INVALID' }, 400);
  }
  if (error instanceof NoteTargetResolutionError) {
    return c.json({ ...details, code: noteTargetResolutionCode(error.kind) }, 422);
  }
  if (error instanceof NoteGenerationUnavailableError) {
    return c.json({ ...details, code: 'NOTE_GENERATION_UNAVAILABLE' }, 503);
  }

  return c.json(details, 500);
}
