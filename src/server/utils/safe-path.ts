import { resolve, normalize, sep } from 'node:path';

/**
 * Validates that a given target path is strictly within the specified base repository directory.
 * Prevents directory traversal attacks (e.g. using `..`).
 * 
 * @param basePath The fully resolved absolute path to the repository root.
 * @param targetPath The untrusted path requested by the client.
 * @returns The safely resolved absolute path, or throws an error.
 */
export function resolveSafePath(basePath: string, targetPath: string): string {
  if (!basePath) {
    throw new Error('Base path must be provided');
  }
  
  // Resolve base path to an absolute, normalized path
  const resolvedBase = resolve(normalize(basePath));
  
  // Resolve target against base
  // Note: if targetPath is absolute, resolve() will use it as the root unless we process it.
  // Removing leading slash from target prevents it from escaping base via root path.
  const sanitizedTarget = targetPath.replace(/^([/\\]+)/, '');
  const resolvedTarget = resolve(resolvedBase, sanitizedTarget);

  // Check if the resolved target starts with the resolved base
  if (!resolvedTarget.startsWith(resolvedBase + sep) && resolvedTarget !== resolvedBase) {
    throw new Error(`Path traversal detected: Access denied to paths outside the repository root.`);
  }

  return resolvedTarget;
}

/**
 * Validates whether the given path is safely within the repo root.
 * Returns boolean instead of throwing.
 */
export function isSafePath(basePath: string, targetPath: string): boolean {
  try {
    resolveSafePath(basePath, targetPath);
    return true;
  } catch {
    return false;
  }
}
