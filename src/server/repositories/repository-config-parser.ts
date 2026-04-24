import type { ServerRepository } from './server-repository';

export interface RepositoryConfig {
  repositories: ServerRepository[];
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
 * @throws {RepositoryConfigParseError} If the string is not valid JSON, which will result in an 'invalid' status for the entire config.
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
 * Maps an unknown JSON entry to a ServerRepository object.
 *
 * This function is fault-tolerant: it avoids throwing errors for malformed individual entries
 * so that other valid repositories in the same configuration file can still be loaded.
 *
 * Invalid entries are assigned placeholder IDs (e.g., `invalid-repo-{index}` or `invalid-id-{index}`)
 * that conform to the required ID pattern. This allows them to pass through the registry,
 * ensuring they can be individually validated and reported as invalid by the `RepositoryValidator` later,
 * without crashing the entire configuration loading process.
 */
function toRepository(value: unknown, index: number): ServerRepository {
  if (!isRecord(value)) {
    return { id: `invalid-repo-${index}`, path: '' };
  }

  const { id, path: repositoryPath } = value;
  const resolvedId = typeof id === 'string' && id.trim() !== '' ? id : `invalid-id-${index}`;
  const resolvedPath = typeof repositoryPath === 'string' ? repositoryPath : '';

  return {
    id: resolvedId,
    path: resolvedPath,
  };
}

/**
 * Validates the root structure of the parsed JSON configuration.
 *
 * @throws {RepositoryConfigParseError} If the root is not an object or if the `repositories` array is missing.
 * These errors represent a completely unusable configuration file and will result in an 'invalid' config status.
 */
function toRepositoryConfig(value: unknown): RepositoryConfig {
  if (!isRecord(value)) {
    throw new RepositoryConfigParseError('Config root must be an object.');
  }

  if (!Array.isArray(value.repositories)) {
    throw new RepositoryConfigParseError('Config must contain a "repositories" array.');
  }

  return {
    repositories: value.repositories.map((repository, index) => toRepository(repository, index)),
  };
}

/**
 * Parses a raw JSON configuration string into a strongly-typed `RepositoryConfig`.
 *
 * @param rawConfig The raw JSON string read from the configuration file.
 * @returns A `RepositoryConfig` object containing an array of `ServerRepository` items.
 *          If individual repository entries are malformed, they will be included with placeholder
 *          `invalid-*` IDs and will be filtered/rejected later in the validation phase.
 * @throws {RepositoryConfigParseError} If the JSON is invalid or the root structure is incorrect.
 */
export function parseRepositoryConfig(rawConfig: string): RepositoryConfig {
  return toRepositoryConfig(parseJson(rawConfig));
}
