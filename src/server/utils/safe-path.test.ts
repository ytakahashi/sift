import { describe, it, expect } from 'vitest';
import { resolveSafePath, isSafePath } from './safe-path';
import { sep } from 'node:path';

describe('resolveSafePath', () => {
  const base = '/repo/root';

  it('resolves a valid relative path', () => {
    const result = resolveSafePath(base, 'src/file.ts');
    expect(result).toBe(`${base}${sep}src${sep}file.ts`);
  });

  it('throws on directory traversal with ..', () => {
    expect(() => resolveSafePath(base, '../etc/passwd')).toThrow('Path traversal detected');
  });

  it('throws on deeply nested traversal', () => {
    expect(() => resolveSafePath(base, 'a/b/../../../../../../etc/passwd')).toThrow(
      'Path traversal detected',
    );
  });

  it('strips leading slashes and resolves safely', () => {
    // An absolute path like "/some/other/path" gets its leading slash stripped,
    // so it becomes relative and resolves inside base.
    const result = resolveSafePath(base, '/some/other/path');
    expect(result.startsWith(base)).toBe(true);
  });

  it('throws when basePath is empty', () => {
    expect(() => resolveSafePath('', 'file.ts')).toThrow('Base path must be provided');
  });

  it('accepts the base path itself', () => {
    // Resolving '.' against base should return the base itself
    const result = resolveSafePath(base, '.');
    expect(result).toBe(base);
  });
});

describe('isSafePath', () => {
  const base = '/repo/root';

  it('returns true for a safe path', () => {
    expect(isSafePath(base, 'src/file.ts')).toBe(true);
  });

  it('returns false for a traversal path', () => {
    expect(isSafePath(base, '../etc/passwd')).toBe(false);
  });
});
