import type { z } from 'zod';
import { errorResponseSchema } from './error-response-schema';

interface HttpErrorDetails {
  status: number;
  code?: string;
  message: string;
  noteIds?: string[];
  commentIndex?: number;
}

export async function parseErrorResponse(
  response: Response,
): Promise<({ kind: 'valid' } & HttpErrorDetails) | { kind: 'invalid' }> {
  const parsed = errorResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    return { kind: 'invalid' };
  }
  const { error, code, ...details } = parsed.data;
  return { ...details, kind: 'valid', status: response.status, code, message: error };
}

export type HttpJsonResult<T extends object> =
  | ({ kind: 'success' } & T)
  | ({ kind: 'http-error' } & HttpErrorDetails)
  | { kind: 'invalid-response' }
  | { kind: 'invalid-error-response' }
  | { kind: 'network-error' };

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (_error: unknown) {
    return undefined;
  }
}

export async function fetchJson<T extends object>(
  request: () => Promise<Response>,
  schema: z.ZodType<T>,
): Promise<HttpJsonResult<T>> {
  let response: Response;
  try {
    response = await request();
  } catch (_error: unknown) {
    return { kind: 'network-error' };
  }

  if (response.status !== 200) {
    if (response.ok) {
      return { kind: 'invalid-response' };
    }
    const parsed = await parseErrorResponse(response);
    return parsed.kind === 'valid'
      ? { ...parsed, kind: 'http-error' }
      : { kind: 'invalid-error-response' };
  }

  const parsed = schema.safeParse(await readJson(response));
  return parsed.success ? { ...parsed.data, kind: 'success' } : { kind: 'invalid-response' };
}
