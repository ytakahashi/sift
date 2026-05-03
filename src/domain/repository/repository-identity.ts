import type { RepositoryId } from './repository';

/**
 * Derives a human-readable repository name from a repository path.
 *
 * Rules:
 * - Trim trailing slashes
 * - Use the final path segment
 * - Fall back to the full path string if no segment can be found
 */
export function deriveRepositoryName(repositoryPath: string): string {
  const trimmed = repositoryPath.replace(/\/+$/g, '') || repositoryPath;
  const segments = trimmed.split('/').filter((segment) => segment.length > 0);
  return segments.at(-1) ?? trimmed;
}

/**
 * Converts a repository name into a URL-safe slug suitable for use
 * as part of a repository ID.
 *
 * Non-alphanumeric characters are replaced with hyphens and leading/trailing
 * hyphens are stripped. Returns `"repository"` for names that produce an
 * empty slug.
 */
export function slugifyRepositoryName(repositoryName: string): string {
  const slug = repositoryName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'repository';
}

// FNV-1a 64-bit constants for deterministic, non-cryptographic hashing.
const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;

/**
 * Computes a compact FNV-1a 64-bit hash of a repository path string.
 *
 * This is a pure deterministic hash with no external or Node.js dependencies,
 * producing a base-36 encoded string suitable for non-cryptographic
 * fingerprinting.
 */
export function hashRepositoryPath(repositoryPath: string): string {
  let hash = FNV_OFFSET_BASIS_64;

  for (let index = 0; index < repositoryPath.length; index += 1) {
    hash ^= BigInt(repositoryPath.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * FNV_PRIME_64);
  }

  return hash.toString(36);
}

/**
 * Derives a stable, deterministic repository ID from a normalized path string.
 *
 * The ID format is `<slugified-name>-<path-fingerprint>`, for example
 * `sift-k4sq91x8`. The fingerprint portion is truncated to 10 characters
 * from a FNV-1a 64-bit hash of the path.
 *
 * The returned ID does not depend on config array order or other configured
 * repositories, ensuring route and subscription stability.
 *
 * The caller is responsible for normalizing the path before calling this
 * function. The domain function treats its input as an already-normalized
 * string and returns a deterministic ID for that exact string.
 */
export function deriveRepositoryId(repositoryPath: string): RepositoryId {
  const name = deriveRepositoryName(repositoryPath);
  const slug = slugifyRepositoryName(name);
  const fingerprint = hashRepositoryPath(repositoryPath).slice(0, 10);

  return `${slug}-${fingerprint}`;
}
