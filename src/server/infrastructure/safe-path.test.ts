import { describe, it, expect } from 'vitest';
import { resolveSafePath } from './safe-path';

describe('resolveSafePath', () => {
  const base = '/repo/root';

  it('resolves a valid relative path', () => {
    // Given: base path is "/repo/root" and relative path is "src/file.ts"
    const relativePath = 'src/file.ts';

    // When: resolving the path
    const result = resolveSafePath(base, relativePath);

    // Then: returns the resolved path
    expect(result).toBe('/repo/root/src/file.ts');
  });

  it('throws on directory traversal with ..', () => {
    // Given: base path is "/repo/root" and relative path is "../etc/passwd"
    const relativePath = '../etc/passwd';

    // When/Then: resolving the path throws an error
    expect(() => resolveSafePath(base, relativePath)).toThrow('Path traversal detected');
  });

  it('throws on deeply nested traversal', () => {
    // Given: base path is "/repo/root" and a deeply nested traversal path
    const relativePath = 'a/b/../../../../../../etc/passwd';

    // When/Then: resolving the path throws an error
    expect(() => resolveSafePath(base, relativePath)).toThrow('Path traversal detected');
  });

  it('strips leading slashes and resolves safely', () => {
    // Given: base path is "/repo/root" and a path with a leading slash
    // An absolute path like "/some/other/path" gets its leading slash stripped,
    // so it becomes relative and resolves inside base.
    const relativePath = '/some/other/path';

    // When: resolving the path
    const result = resolveSafePath(base, relativePath);

    // Then: it resolves safely inside the base path
    expect(result.startsWith(base)).toBe(true);
    expect(result).toBe('/repo/root/some/other/path');
  });

  it('throws when basePath is empty', () => {
    // Given: an empty base path
    const emptyBase = '';

    // When/Then: resolving any path throws an error
    expect(() => resolveSafePath(emptyBase, 'file.ts')).toThrow('Base path must be provided');
  });

  it('accepts the base path itself', () => {
    // Given: base path and the "." relative path
    const relativePath = '.';

    // When: resolving "." against base
    const result = resolveSafePath(base, relativePath);

    // Then: returns the base path itself
    expect(result).toBe(base);
  });
});
