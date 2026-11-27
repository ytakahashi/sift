import type { Note, NoteCreateTarget } from '../domain/notes/types';
import { buildLocalServerUrl } from '../server/fixed-port';
import { fetchJson, parseErrorResponse, type HttpJsonResult } from './http-json-client';
import { noteSchema, notesListResponseSchema } from './notes-schema';

function notesUrl(port: number, repoId: string): string {
  return `${buildLocalServerUrl(port)}/api/repositories/${encodeURIComponent(repoId)}/notes`;
}

function noteUrl(port: number, repoId: string, noteId: string): string {
  return `${notesUrl(port, repoId)}/${encodeURIComponent(noteId)}`;
}

export type GetNotesResult = HttpJsonResult<{ notes: Note[] }>;

export async function getNotes(
  port: number,
  repoId: string,
  reviewId?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GetNotesResult> {
  const url = notesUrl(port, repoId);
  const query = reviewId === undefined ? '' : `?${new URLSearchParams({ reviewId })}`;
  return fetchJson(() => fetchImpl(url + query), notesListResponseSchema);
}

/**
 * Creation is the only note operation that can fail with an unknown outcome:
 * a retry after an unconfirmed POST can leave a duplicate note behind, so the
 * caller has to be told to check before retrying. `updateNote`/`deleteNote`
 * address an existing note by id and are safe to retry, hence no `uncertain`
 * there.
 */
export type CreateNoteResult =
  | { kind: 'success'; note: Note }
  | { kind: 'known-error'; status: number; code?: string; message: string }
  | { kind: 'invalid-error-response' }
  | { kind: 'uncertain' };

export async function createNote(
  port: number,
  repoId: string,
  target: NoteCreateTarget,
  body: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CreateNoteResult> {
  let response: Response;
  try {
    response = await fetchImpl(notesUrl(port, repoId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, body, source: 'mcp' }),
    });
  } catch (_error: unknown) {
    // The request was already dispatched; a network failure at this point
    // does not tell us whether the server received and saved it.
    return { kind: 'uncertain' };
  }

  if (response.status === 500) {
    // The request was already dispatched and the note write happens before the
    // response is built, so an unexpected 500 does not tell us whether the note
    // was saved.
    return { kind: 'uncertain' };
  }

  // The POST contract is 201; any other 2xx (e.g. 200, 202) doesn't match it.
  // Since the request was already dispatched, that mismatch cannot be ruled a
  // definite failure, so it is uncertain rather than a known error.
  if (response.status !== 201) {
    if (response.ok) {
      return { kind: 'uncertain' };
    }
    const parsedError = await parseErrorResponse(response);
    if (parsedError.kind === 'invalid') {
      return { kind: 'invalid-error-response' };
    }
    return {
      kind: 'known-error',
      status: parsedError.status,
      code: parsedError.code,
      message: parsedError.message,
    };
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (_error: unknown) {
    return { kind: 'uncertain' };
  }

  const parsed = noteSchema.safeParse(responseBody);
  return parsed.success ? { kind: 'success', note: parsed.data } : { kind: 'uncertain' };
}

/**
 * Unlike `createNote`, this has no `uncertain` outcome: PATCH replaces the
 * whole body, so resending the same request converges on the same note and an
 * unconfirmed attempt can simply be retried.
 */
export type UpdateNoteResult =
  | { kind: 'success'; note: Note }
  | Extract<HttpJsonResult<object>, { kind: 'http-error' }>
  | { kind: 'invalid-response' }
  | { kind: 'invalid-error-response' }
  | { kind: 'network-error' };

export async function updateNote(
  port: number,
  repoId: string,
  noteId: string,
  body: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UpdateNoteResult> {
  let response: Response;
  try {
    response = await fetchImpl(noteUrl(port, repoId, noteId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
  } catch (_error: unknown) {
    return { kind: 'network-error' };
  }

  // The PATCH contract is 200; any other 2xx doesn't match it and its body
  // shape is unknown, so it is treated the same as a malformed response rather
  // than assumed to carry the updated note.
  if (response.status !== 200) {
    if (response.ok) {
      return { kind: 'invalid-response' };
    }
    const parsedError = await parseErrorResponse(response);
    if (parsedError.kind === 'invalid') {
      return { kind: 'invalid-error-response' };
    }
    return { ...parsedError, kind: 'http-error' };
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (_error: unknown) {
    return { kind: 'invalid-response' };
  }

  const parsed = noteSchema.safeParse(responseBody);
  return parsed.success ? { kind: 'success', note: parsed.data } : { kind: 'invalid-response' };
}

/**
 * Like `updateNote`, retry-safe and therefore without an `uncertain` outcome:
 * a repeated DELETE removes nothing extra, it only turns into a 404.
 */
export type DeleteNoteResult =
  | { kind: 'success' }
  | Extract<HttpJsonResult<object>, { kind: 'http-error' }>
  | { kind: 'invalid-response' }
  | { kind: 'invalid-error-response' }
  | { kind: 'network-error' };

export async function deleteNote(
  port: number,
  repoId: string,
  noteId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeleteNoteResult> {
  let response: Response;
  try {
    response = await fetchImpl(noteUrl(port, repoId, noteId), { method: 'DELETE' });
  } catch (_error: unknown) {
    return { kind: 'network-error' };
  }

  // The DELETE contract is 204. A different 2xx means the server is not
  // speaking this contract, which is not something to report as a deletion.
  if (response.status !== 204) {
    if (response.ok) {
      return { kind: 'invalid-response' };
    }
    const parsedError = await parseErrorResponse(response);
    if (parsedError.kind === 'invalid') {
      return { kind: 'invalid-error-response' };
    }
    return { ...parsedError, kind: 'http-error' };
  }

  return { kind: 'success' };
}
