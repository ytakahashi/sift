import type { ErrorResponseCode } from '../server/routes/route-error';
import { isKnownErrorResponseCode } from './error-response-schema';

export function describeUnreachable(): string {
  return 'Could not connect to the local Sift server. Start it with `sift open` or `sift serve` and retry.';
}

export function describeIncompatibleProduct(): string {
  return 'Another process is using the configured port; it is not a Sift server. Check the PORT environment variable or the other process.';
}

export function describeCapabilityMissing(): string {
  return 'The running Sift server is too old to support the Notes API. Update Sift and restart the server.';
}

export function describeRepoRootResolutionFailure(candidatePath: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    `Could not resolve a git repository at "${candidatePath}": ${message}. ` +
    'Pass the correct path with --repo, or run `sift mcp` from inside a git repository.'
  );
}

export function describeUnregisteredRepository(repoRoot: string): string {
  return (
    `"${repoRoot}" is not registered with Sift. Run \`sift add ${repoRoot}\` and retry; ` +
    'no server restart is needed.'
  );
}

export function describeRepositoryLookupFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (
    `Could not read the Sift repository configuration: ${message}. ` +
    'Check the configuration file and retry.'
  );
}

export function describePortResolutionFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Could not determine the local Sift server port: ${message}`;
}

export function describeInvalidResponse(): string {
  return 'Sift server returned a response that could not be understood. Update or restart the Sift server.';
}

export const UNCERTAIN_ADD_NOTE_MESSAGE =
  'Could not confirm whether the note was created. To avoid a duplicate, call list_notes for the ' +
  'same target and body before retrying.';

/**
 * Shared actionable-guidance mapping for both `list_notes` and `add_note`
 * non-2xx responses that are not "uncertain" (add_note's own uncertain cases
 * are handled separately, before this is ever called). Exhaustively switches
 * over known codes so adding a new `ErrorResponseCode` without a case here
 * fails the build instead of silently falling back to a generic message.
 */
export function describeKnownError(
  code: string | undefined,
  message: string,
  status: number,
): string {
  if (isKnownErrorResponseCode(code)) {
    return describeKnownErrorCode(code, message);
  }

  if (status === 500) {
    return `${message} (status 500). This may be a Sift server bug; check the server logs.`;
  }

  return `${message} (status ${status}). Check the repository configuration; you may need to run \`sift add <repository root>\`.`;
}

function describeKnownErrorCode(code: ErrorResponseCode, message: string): string {
  switch (code) {
    case 'NOTE_TARGET_AMBIGUOUS':
      return `${message} Specify "bucket" as "working" or "staged" and retry.`;
    case 'NOTE_TARGET_NOT_FOUND':
      return (
        `${message} The target is not part of the current diff, or does not fit within a single ` +
        'diff hunk. Retry with kind: "file" for a whole-file comment instead.'
      );
    case 'NOTE_TARGET_INELIGIBLE':
      return `${message} This file (e.g. a submodule) cannot have notes.`;
    case 'NOTE_GENERATION_UNAVAILABLE':
      return `${message} The file state could not be checked; retry with the same content.`;
    case 'NOTE_REQUEST_INVALID':
      return `${message} Fix the request as described and retry.`;
    case 'REPOSITORY_NOT_FOUND':
    case 'REPOSITORY_INVALID':
      return `${message} Check the repository's registration state.`;
    case 'NOTE_NOT_FOUND':
      return message;
    default: {
      // Compile-time exhaustiveness check: adding a new ErrorResponseCode
      // without a case here fails the build instead of silently returning
      // a generic message for it.
      const unhandled: never = code;
      throw new Error(`Unhandled ErrorResponseCode: ${String(unhandled)}`);
    }
  }
}
