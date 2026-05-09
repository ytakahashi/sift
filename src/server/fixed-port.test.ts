import { describe, expect, it, vi } from 'vitest';
import { buildLocalServerUrl, checkExistingSiftServer } from './fixed-port';

describe('buildLocalServerUrl', () => {
  it('builds the local URL for a fixed port', () => {
    // Given / When / Then
    expect(buildLocalServerUrl(49321)).toBe('http://localhost:49321');
  });
});

describe('checkExistingSiftServer', () => {
  it('detects an existing Sift server from the health marker', async () => {
    // Given
    // The version field is irrelevant to the marker check; any string suffices.
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'sift', version: '0.0.0' }),
      ok: true,
    });

    // When
    const status = await checkExistingSiftServer(49321, fetchHealth);

    // Then
    expect(fetchHealth).toHaveBeenCalledWith('http://localhost:49321/api/health');
    expect(status).toBe('sift');
  });

  it('reports another process when the health marker does not match', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'other' }),
      ok: true,
    });

    // When / Then
    await expect(checkExistingSiftServer(49321, fetchHealth)).resolves.toBe('other');
  });

  it('reports unreachable when the health request cannot connect', async () => {
    // Given
    const fetchHealth = vi.fn().mockRejectedValue(new Error('connection refused'));

    // When / Then
    await expect(checkExistingSiftServer(49321, fetchHealth)).resolves.toBe('unreachable');
  });

  it('reports another process when the health endpoint is not ok', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn(),
      ok: false,
    });

    // When / Then
    await expect(checkExistingSiftServer(49321, fetchHealth)).resolves.toBe('other');
  });
});
