import type { Note, NoteCreateTarget } from '../domain/notes/types';
import { buildLocalServerUrl } from '../server/fixed-port';
import { errorResponseSchema } from './error-response-schema';
import { noteSchema, notesListResponseSchema } from './notes-schema';

function notesUrl(port: number, repoId: string): string {
  return `${buildLocalServerUrl(port)}/api/repositories/${encodeURIComponent(repoId)}/notes`;
}

type ParsedErrorResponse =
  { kind: 'valid'; status: number; code?: string; message: string } | { kind: 'invalid' };

async function parseErrorResponse(response: Response): Promise<ParsedErrorResponse> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (_error: unknown) {
    return { kind: 'invalid' };
  }

  const parsed = errorResponseSchema.safeParse(body);
  return parsed.success
    ? {
        kind: 'valid',
        status: response.status,
        code: parsed.data.code,
        message: parsed.data.error,
      }
    : { kind: 'invalid' };
}

export type GetNotesResult =
  | { kind: 'success'; notes: Note[] }
  | { kind: 'http-error'; status: number; code?: string; message: string }
  | { kind: 'invalid-response' }
  | { kind: 'invalid-error-response' }
  | { kind: 'network-error' };

export async function getNotes(
  port: number,
  repoId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GetNotesResult> {
  let response: Response;
  try {
    response = await fetchImpl(notesUrl(port, repoId));
  } catch (_error: unknown) {
    return { kind: 'network-error' };
  }

  // The GET contract is 200; any other 2xx (e.g. 204) doesn't match it and its
  // body shape is unknown, so it is treated the same as a malformed response
  // rather than assumed to carry notes.
  if (response.status !== 200) {
    if (response.ok) {
      return { kind: 'invalid-response' };
    }
    const parsedError = await parseErrorResponse(response);
    if (parsedError.kind === 'invalid') {
      return { kind: 'invalid-error-response' };
    }
    return {
      kind: 'http-error',
      status: parsedError.status,
      code: parsedError.code,
      message: parsedError.message,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (_error: unknown) {
    return { kind: 'invalid-response' };
  }

  const parsed = notesListResponseSchema.safeParse(body);
  return parsed.success
    ? { kind: 'success', notes: parsed.data.notes }
    : { kind: 'invalid-response' };
}

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
      body: JSON.stringify({ target, body }),
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
