import { describe, expect, it } from 'vitest';
import type { ConfirmedFileGeneration, FileGeneration } from './file-generation';
import { serializeFileGeneration } from './file-generation';

describe('serializeFileGeneration', () => {
  it('returns a stable representation for each confirmed kind', () => {
    // Given: one generation of each confirmed kind
    const file: ConfirmedFileGeneration = { kind: 'file', blobId: 'abc123', mode: '100644' };
    const symlink: ConfirmedFileGeneration = { kind: 'symlink', targetHash: 'def456' };
    const deleted: ConfirmedFileGeneration = { kind: 'deleted' };

    // When / Then: each kind serializes to a distinct, stable string
    expect(serializeFileGeneration(file)).toBe('file:abc123:100644');
    expect(serializeFileGeneration(symlink)).toBe('symlink:def456');
    expect(serializeFileGeneration(deleted)).toBe('deleted');
  });

  it('treats a mode-only difference as a different generation', () => {
    // Given: the same blob with different file modes (e.g. chmod +x)
    const regular: ConfirmedFileGeneration = { kind: 'file', blobId: 'abc123', mode: '100644' };
    const executable: ConfirmedFileGeneration = { kind: 'file', blobId: 'abc123', mode: '100755' };

    // When / Then: the serialized generations differ
    expect(serializeFileGeneration(regular)).not.toBe(serializeFileGeneration(executable));
  });

  it('excludes unavailable from confirmed generations at the type level', () => {
    // Given: an unavailable generation (indeterminate, not a real generation)
    const unavailable: FileGeneration = { kind: 'unavailable', reason: 'read error' };

    // Then: it is not assignable to ConfirmedFileGeneration, so it can never
    // be stored as an anchor or compared for equality
    // @ts-expect-error unavailable must not be accepted as a confirmed generation
    const rejected: ConfirmedFileGeneration = unavailable;
    expect(rejected.kind).toBe('unavailable');
  });
});
