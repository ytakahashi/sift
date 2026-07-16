import type { Context } from 'hono';
import type { Env } from '../create-app';
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

export function handleRouteError(c: Context<Env>, error: unknown): Response {
  if (error instanceof RepositoryConfigResolutionError) {
    return c.json({ error: error.message }, error.kind === 'missing' ? 404 : 400);
  }
  if (error instanceof RepositoryNotFoundError) {
    return c.json({ error: error.message }, 404);
  }
  if (error instanceof RepositoryValidationError) {
    return c.json({ error: error.message }, 422);
  }

  if (error instanceof RepositoryConfigUpdateError) {
    return c.json({ error: error.message }, error.statusCode);
  }

  if (error instanceof NoteNotFoundError) {
    return c.json({ error: error.message }, 404);
  }
  if (error instanceof NoteRequestValidationError) {
    return c.json({ error: error.message }, 400);
  }
  if (error instanceof NoteTargetResolutionError) {
    return c.json({ error: error.message }, 422);
  }
  if (error instanceof NoteGenerationUnavailableError) {
    return c.json({ error: error.message }, 503);
  }

  return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
}
