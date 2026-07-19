import { describe, expect, it, vi } from 'vitest';
import { checkNotesApiCompatibility } from './notes-compatibility';

describe('checkNotesApiCompatibility', () => {
  it('reports compatible when the Sift server advertises notes-v1', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi
        .fn()
        .mockResolvedValue({ product: 'sift', version: '1.2.3', capabilities: ['notes-v1'] }),
      ok: true,
    });

    // When
    const result = await checkNotesApiCompatibility(49321, fetchHealth);

    // Then
    expect(result).toEqual({ kind: 'compatible' });
  });

  it('reports capability-missing for a Sift server without notes-v1', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'sift', version: '0.9.0', capabilities: [] }),
      ok: true,
    });

    // When
    const result = await checkNotesApiCompatibility(49321, fetchHealth);

    // Then
    expect(result).toEqual({ kind: 'capability-missing' });
  });

  it('reports capability-missing for a legacy Sift server with no capabilities field', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'sift', version: '0.9.0' }),
      ok: true,
    });

    // When
    const result = await checkNotesApiCompatibility(49321, fetchHealth);

    // Then
    expect(result).toEqual({ kind: 'capability-missing' });
  });

  it('reports incompatible-product when another process owns the port', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'other' }),
      ok: true,
    });

    // When
    const result = await checkNotesApiCompatibility(49321, fetchHealth);

    // Then
    expect(result).toEqual({ kind: 'incompatible-product' });
  });

  it('reports unreachable when the port cannot be connected to', async () => {
    // Given
    const fetchHealth = vi.fn().mockRejectedValue(new Error('connection refused'));

    // When
    const result = await checkNotesApiCompatibility(49321, fetchHealth);

    // Then
    expect(result).toEqual({ kind: 'unreachable' });
  });
});
