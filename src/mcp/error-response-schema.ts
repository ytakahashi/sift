import { z } from 'zod';
import { ERROR_RESPONSE_CODES, type ErrorResponseCode } from '../server/routes/route-error';

/**
 * `code` is validated as a plain string, not `z.enum(ERROR_RESPONSE_CODES)`.
 * A server ahead of this client on error codes must still be treated as a
 * well-formed, actionable error response (the HTTP status already tells the
 * caller whether the request failed before or after a write); only
 * `isKnownErrorResponseCode` below narrows to the closed set, for callers
 * that need to switch on specific codes.
 */
export const errorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
  })
  .strict();

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export function isKnownErrorResponseCode(code: string | undefined): code is ErrorResponseCode {
  return code !== undefined && (ERROR_RESPONSE_CODES as readonly string[]).includes(code);
}
