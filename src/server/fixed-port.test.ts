import { describe, expect, it, vi } from 'vitest';
import {
  buildLocalServerUrl,
  checkExistingSiftServer,
  probeLocalServer,
  resolvePort,
} from './fixed-port';

describe('buildLocalServerUrl', () => {
  it('builds the local URL for a fixed port', () => {
    // Given / When / Then
    // Must match the host the server actually binds (127.0.0.1), not "localhost",
    // which can resolve to IPv6 ::1 in some environments and fail to connect.
    expect(buildLocalServerUrl(49321)).toBe('http://127.0.0.1:49321');
  });
});

describe('probeLocalServer', () => {
  it('identifies a Sift server with capabilities', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi
        .fn()
        .mockResolvedValue({ product: 'sift', version: '1.2.3', capabilities: ['notes-v1'] }),
      ok: true,
    });

    // When
    const probe = await probeLocalServer(49321, fetchHealth);

    // Then
    expect(fetchHealth).toHaveBeenCalledWith('http://127.0.0.1:49321/api/health');
    expect(probe).toEqual({ kind: 'sift', version: '1.2.3', capabilities: ['notes-v1'] });
  });

  it('normalizes a missing capabilities field to an empty array for a legacy Sift server', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'sift', version: '1.0.0' }),
      ok: true,
    });

    // When
    const probe = await probeLocalServer(49321, fetchHealth);

    // Then
    expect(probe).toEqual({ kind: 'sift', version: '1.0.0', capabilities: [] });
  });

  it('reports another process when capabilities is present but not a string array', async () => {
    // Given
    // A malformed capabilities field must not be confused with the legacy "missing
    // capabilities" case; treat the whole response as untrustworthy instead.
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'sift', version: '1.2.3', capabilities: [1, 2] }),
      ok: true,
    });

    // When / Then
    await expect(probeLocalServer(49321, fetchHealth)).resolves.toEqual({ kind: 'other' });
  });

  it('reports another process when the product marker does not match', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'other', version: '1.2.3' }),
      ok: true,
    });

    // When / Then
    await expect(probeLocalServer(49321, fetchHealth)).resolves.toEqual({ kind: 'other' });
  });

  it('reports another process when version is not a string', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ product: 'sift', version: 123 }),
      ok: true,
    });

    // When / Then
    await expect(probeLocalServer(49321, fetchHealth)).resolves.toEqual({ kind: 'other' });
  });

  it('reports another process when the health endpoint is not ok', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn(),
      ok: false,
    });

    // When / Then
    await expect(probeLocalServer(49321, fetchHealth)).resolves.toEqual({ kind: 'other' });
  });

  it('reports another process when the response body is not valid JSON', async () => {
    // Given
    const fetchHealth = vi.fn().mockResolvedValue({
      json: vi.fn().mockRejectedValue(new Error('invalid JSON')),
      ok: true,
    });

    // When / Then
    await expect(probeLocalServer(49321, fetchHealth)).resolves.toEqual({ kind: 'other' });
  });

  it('reports unreachable when the health request cannot connect', async () => {
    // Given
    const fetchHealth = vi.fn().mockRejectedValue(new Error('connection refused'));

    // When / Then
    await expect(probeLocalServer(49321, fetchHealth)).resolves.toEqual({ kind: 'unreachable' });
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
    expect(fetchHealth).toHaveBeenCalledWith('http://127.0.0.1:49321/api/health');
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

describe('resolvePort', () => {
  it('returns the default port when PORT is unset', () => {
    // Given / When / Then
    expect(resolvePort({})).toBe(49321);
  });

  it('respects a valid decimal PORT value', () => {
    // Given / When / Then
    expect(resolvePort({ PORT: '3000' })).toBe(3000);
  });

  it('throws when PORT has trailing non-numeric characters', () => {
    // Given / When / Then
    // parseInt would silently accept "49321x" as 49321; resolvePort must not.
    expect(() => resolvePort({ PORT: '49321x' })).toThrow(/Invalid PORT/);
  });

  it('throws when PORT is out of the 1..65535 range', () => {
    // Given / When / Then
    expect(() => resolvePort({ PORT: '0' })).toThrow(/Invalid PORT/);
    expect(() => resolvePort({ PORT: '65536' })).toThrow(/Invalid PORT/);
  });

  it('throws when PORT is negative or fractional', () => {
    // Given / When / Then
    expect(() => resolvePort({ PORT: '-1' })).toThrow(/Invalid PORT/);
    expect(() => resolvePort({ PORT: '3000.5' })).toThrow(/Invalid PORT/);
  });
});
