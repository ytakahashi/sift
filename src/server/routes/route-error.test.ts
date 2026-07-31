import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { Env } from './env';
import {
  NoteGenerationUnavailableError,
  NoteNotFoundError,
  NoteRequestValidationError,
  NoteTargetResolutionError,
} from '../services/notes-store';
import {
  RepositoryNotFoundError,
  RepositoryValidationError,
} from '../services/repository-resolver';
import { handleRouteError } from './route-error';
import type { ErrorResponseCode } from '../contract/error-codes';

interface ErrorMappingFixture {
  label: string;
  error: Error;
  status: number;
  code: ErrorResponseCode;
}

const ERROR_MAPPINGS: ErrorMappingFixture[] = [
  {
    label: 'an unregistered repository',
    error: new RepositoryNotFoundError('boom'),
    status: 404,
    code: 'REPOSITORY_NOT_FOUND',
  },
  {
    label: 'an invalid repository',
    error: new RepositoryValidationError('boom'),
    status: 422,
    code: 'REPOSITORY_INVALID',
  },
  {
    label: 'an invalid note request',
    error: new NoteRequestValidationError('boom'),
    status: 400,
    code: 'NOTE_REQUEST_INVALID',
  },
  {
    label: 'a missing note target',
    error: new NoteTargetResolutionError('boom', 'not-found'),
    status: 422,
    code: 'NOTE_TARGET_NOT_FOUND',
  },
  {
    label: 'an ineligible note target',
    error: new NoteTargetResolutionError('boom', 'ineligible'),
    status: 422,
    code: 'NOTE_TARGET_INELIGIBLE',
  },
  {
    label: 'an ambiguous note target',
    error: new NoteTargetResolutionError('boom', 'ambiguous'),
    status: 422,
    code: 'NOTE_TARGET_AMBIGUOUS',
  },
  {
    label: 'an unavailable file generation',
    error: new NoteGenerationUnavailableError('boom'),
    status: 503,
    code: 'NOTE_GENERATION_UNAVAILABLE',
  },
  {
    label: 'a missing note',
    error: new NoteNotFoundError('boom'),
    status: 404,
    code: 'NOTE_NOT_FOUND',
  },
];

describe('handleRouteError', () => {
  it.each(ERROR_MAPPINGS)('maps $label to a stable error code', async ({ error, status, code }) => {
    // Given: a route delegates a known service error to the shared handler
    const app = new Hono<Env>();
    app.get('/', (c) => handleRouteError(c, error));

    // When: the route is requested
    const response = await app.request('/');

    // Then: the existing message and machine-readable classification are both returned
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: 'boom', code });
  });

  it('keeps unexpected errors backward-compatible without an invented code', async () => {
    // Given: a route delegates an unexpected failure to the shared handler
    const app = new Hono<Env>();
    app.get('/', (c) => handleRouteError(c, new Error('boom')));

    // When: the route is requested
    const response = await app.request('/');

    // Then: the generic response retains its existing shape
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'boom' });
  });
});
