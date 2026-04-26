import type { Context } from 'hono';
import type { Env } from '../create-app';
import { RepositoryResolutionError } from '../services/repository-resolver';

export function handleRouteError(c: Context<Env>, error: unknown): Response {
  if (error instanceof RepositoryResolutionError) {
    return c.json({ error: error.message }, 400);
  }
  return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
}
