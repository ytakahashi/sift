import type { RepositoryId } from '../../domain/repository/repository';

/**
 * Custom URL scheme used to deliver "open this repository" intents to the
 * desktop app.
 *
 * A registered URL scheme is routed by macOS to the running instance through
 * the Electron `open-url` event, so the same mechanism handles both the cold
 * start and the already-running case. On platforms that launch the app with
 * the URL on the command line, the same `sift://` form is recovered from argv.
 */
export const SIFT_URL_SCHEME = 'sift';

// Host segment that namespaces repository-open intents within the scheme,
// leaving room for other intent kinds in the future.
const REPOSITORY_HOST = 'repos';
const REPOSITORY_URL_PREFIX = `${SIFT_URL_SCHEME}://${REPOSITORY_HOST}/`;

/**
 * Builds a `sift://repos/<id>` URL that instructs the desktop app to open the
 * given repository.
 */
export function buildRepositoryAppUrl(repoId: RepositoryId): string {
  return `${REPOSITORY_URL_PREFIX}${encodeURIComponent(repoId)}`;
}

/**
 * Extracts the repository ID from a `sift://repos/<id>` URL.
 *
 * Returns `null` for URLs that do not match the repository-open shape (wrong
 * scheme/host, missing ID, or malformed percent-encoding) so callers can
 * safely ignore unrelated URLs.
 */
export function parseRepositoryIdFromAppUrl(url: string): RepositoryId | null {
  if (!url.startsWith(REPOSITORY_URL_PREFIX)) {
    return null;
  }

  const encodedId = url.slice(REPOSITORY_URL_PREFIX.length);
  if (encodedId.length === 0) {
    return null;
  }

  try {
    const repoId = decodeURIComponent(encodedId);
    return repoId.length > 0 ? repoId : null;
  } catch (_error: unknown) {
    // Malformed percent-encoding: treat as an unrecognized URL.
    return null;
  }
}

/**
 * Finds a repository-open intent among the command-line arguments delivered to
 * a secondary Electron process.
 *
 * Scans from the end so the most recent `sift://repos/<id>` intent wins when the
 * platform appends several, and skips arguments that are not repository URLs
 * (platform flags, malformed URLs).
 */
export function findRepositoryIdFromArgv(argv: readonly string[]): RepositoryId | null {
  for (let index = argv.length - 1; index >= 0; index -= 1) {
    const repoId = parseRepositoryIdFromAppUrl(argv[index]);
    if (repoId !== null) {
      return repoId;
    }
  }

  return null;
}
