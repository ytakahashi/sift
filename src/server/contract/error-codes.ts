/**
 * Machine-readable `code` values carried by error response bodies.
 *
 * Defined as a runtime array (rather than a plain union type) so callers
 * outside this module can validate a `code` value against the exact known
 * set instead of duplicating the literal list.
 */
export const ERROR_RESPONSE_CODES = [
  'REPOSITORY_NOT_FOUND',
  'REPOSITORY_INVALID',
  'NOTE_REQUEST_INVALID',
  'NOTE_TARGET_NOT_FOUND',
  'NOTE_TARGET_INELIGIBLE',
  'NOTE_TARGET_AMBIGUOUS',
  'NOTE_GENERATION_UNAVAILABLE',
  'NOTE_NOT_FOUND',
] as const;

export type ErrorResponseCode = (typeof ERROR_RESPONSE_CODES)[number];
