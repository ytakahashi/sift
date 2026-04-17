import { describe, it, expect } from 'vitest';
import { getLanguageFromPath } from './language';

describe('getLanguageFromPath', () => {
  it('should return undefined if filePath is undefined', () => {
    // Given
    const filePath = undefined;

    // When
    const result = getLanguageFromPath(filePath);

    // Then
    expect(result).toBeUndefined();
  });

  it('should return undefined if filePath has no extension', () => {
    // Given
    const filePath = 'Makefile';

    // When
    const result = getLanguageFromPath(filePath);

    // Then
    expect(result).toBeUndefined();
  });

  it('should return undefined if the extension is not in the mapping', () => {
    // Given
    const filePath = 'app.unknown';

    // When
    const result = getLanguageFromPath(filePath);

    // Then
    expect(result).toBeUndefined();
  });

  it('should return the correct language for a known extension', () => {
    // Given
    const filePath = 'src/app.tsx';

    // When
    const result = getLanguageFromPath(filePath);

    // Then
    expect(result).toBe('tsx');
  });

  it('should be case-insensitive to extensions', () => {
    // Given
    const filePath = 'README.MD';

    // When
    const result = getLanguageFromPath(filePath);

    // Then
    expect(result).toBe('markdown');
  });

  it('should handle paths with multiple dots', () => {
    // Given
    const filePath = 'utils.test.ts';

    // When
    const result = getLanguageFromPath(filePath);

    // Then
    expect(result).toBe('typescript');
  });
});
