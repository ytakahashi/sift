import { describe, expect, it } from 'vitest';
import { errorResponseSchema, isKnownErrorResponseCode } from './error-response-schema';

describe('errorResponseSchema', () => {
  it('accepts an error with a known code', () => {
    // Given
    const candidate = { error: 'not found', code: 'NOTE_NOT_FOUND' };

    // When
    const result = errorResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('accepts an error with no code', () => {
    // Given
    const candidate = { error: 'something went wrong' };

    // When
    const result = errorResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('accepts an error with a code unrecognized by this client (forward compatibility)', () => {
    // Given
    const candidate = { error: 'new failure kind', code: 'SOME_FUTURE_CODE' };

    // When
    const result = errorResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects a response missing the error message', () => {
    // Given
    const candidate = { code: 'NOTE_NOT_FOUND' };

    // When
    const result = errorResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('rejects a non-string code', () => {
    // Given
    const candidate = { error: 'x', code: 404 };

    // When
    const result = errorResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('rejects an unknown extra property', () => {
    // Given
    const candidate = { error: 'x', extra: true };

    // When
    const result = errorResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});

describe('isKnownErrorResponseCode', () => {
  it('returns true for a code in the known set', () => {
    // Given
    const code = 'NOTE_TARGET_AMBIGUOUS';

    // When
    const result = isKnownErrorResponseCode(code);

    // Then
    expect(result).toBe(true);
  });

  it('returns false for an unrecognized code', () => {
    // Given
    const code = 'SOME_FUTURE_CODE';

    // When
    const result = isKnownErrorResponseCode(code);

    // Then
    expect(result).toBe(false);
  });

  it('returns false for undefined', () => {
    // Given
    const code = undefined;

    // When
    const result = isKnownErrorResponseCode(code);

    // Then
    expect(result).toBe(false);
  });
});
