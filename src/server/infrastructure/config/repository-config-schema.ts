export interface RepositoryConfigEntry {
  path: string;
}

export interface RepositoryConfig {
  repositories: RepositoryConfigEntry[];
}

export class RepositoryConfigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryConfigParseError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses the raw configuration string as JSON.
 * @throws {RepositoryConfigParseError} If the string is not valid JSON.
 */
function parseJson(rawConfig: string): unknown {
  try {
    return JSON.parse(rawConfig) as unknown;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RepositoryConfigParseError(`Invalid JSON config: ${message}`);
  }
}

/**
 * Validates a single repository config entry.
 *
 * This function returns the entry if it is valid, or null if it is malformed.
 * Malformed entries are filtered out during parsing so that other valid
 * repositories in the same config can still load without causing duplicate
 * ID crashes from empty paths.
 *
 * For backwards compatibility, entries with an `id` field (old format) are
 * accepted — the `id` is ignored and only `path` is extracted.
 */
function toConfigEntry(value: unknown): RepositoryConfigEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const { path: repositoryPath } = value;
  if (typeof repositoryPath !== 'string' || repositoryPath.trim() === '') {
    return null;
  }

  return { path: repositoryPath };
}

/**
 * Validates the root structure of the parsed JSON configuration.
 *
 * @throws {RepositoryConfigParseError} If the root is not an object or if the
 *   `repositories` array is missing.
 */
function toRepositoryConfig(value: unknown): RepositoryConfig {
  if (!isRecord(value)) {
    throw new RepositoryConfigParseError('Config root must be an object.');
  }

  if (!Array.isArray(value.repositories)) {
    throw new RepositoryConfigParseError('Config must contain a "repositories" array.');
  }

  return {
    repositories: value.repositories
      .map((entry) => toConfigEntry(entry))
      .filter((entry): entry is RepositoryConfigEntry => entry !== null),
  };
}

/**
 * Parses a raw JSON configuration string into a strongly-typed
 * `RepositoryConfig` with path-only entries.
 *
 * @param rawConfig The raw JSON string read from the configuration file.
 * @returns A `RepositoryConfig` containing path-only entries. If individual
 *   entries are malformed, they are included with an empty path and will be
 *   rejected during the validation phase.
 * @throws {RepositoryConfigParseError} If the JSON is invalid or the root
 *   structure is incorrect.
 */
export function parseRepositoryConfig(rawConfig: string): RepositoryConfig {
  return toRepositoryConfig(parseJson(rawConfig));
}

/**
 * Formats a config object as a pretty-printed JSON string with a trailing
 * newline, ready for writing to disk.
 */
export function formatRepositoryConfig(config: RepositoryConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}
