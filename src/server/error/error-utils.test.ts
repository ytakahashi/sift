import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './error-utils';

describe('getErrorMessage', () => {
  it('returns error message or stringified object', () => {
    expect(getErrorMessage(new Error('failed'))).toBe('failed');
    expect(getErrorMessage('plain failure')).toBe('plain failure');
  });
});
