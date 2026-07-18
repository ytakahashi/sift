import { describe, expect, it } from 'vitest';
import { formatLineRange } from './line-range';

describe('formatLineRange', () => {
  it('formats a single-line range', () => {
    // Given: a range whose endpoints are equal

    // When: the range is formatted
    const result = formatLineRange(42, 42);

    // Then: a singular label is returned
    expect(result).toBe('Line 42');
  });

  it('formats a multi-line range', () => {
    // Given: a range with distinct endpoints

    // When: the range is formatted
    const result = formatLineRange(12, 18);

    // Then: a plural label with an en dash is returned
    expect(result).toBe('Lines 12–18');
  });
});
