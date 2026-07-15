import { describe, expect, it } from 'vitest';
import { isNoteEligibleFile } from './note-eligibility';

describe('isNoteEligibleFile', () => {
  it('rejects only submodules', () => {
    // Given / When / Then: every kind except submodule accepts notes
    expect(isNoteEligibleFile({ kind: 'text' })).toBe(true);
    expect(isNoteEligibleFile({ kind: 'image' })).toBe(true);
    expect(isNoteEligibleFile({ kind: 'binary' })).toBe(true);
    expect(isNoteEligibleFile({ kind: 'submodule' })).toBe(false);
  });
});
