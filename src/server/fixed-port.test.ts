import { describe, expect, it } from 'vitest';
import { buildLocalServerUrl, resolvePort } from './fixed-port';

describe('buildLocalServerUrl', () => {
  it('builds the local URL for a fixed port', () => {
    // Given / When / Then
    // Must match the host the server actually binds (127.0.0.1), not "localhost",
    // which can resolve to IPv6 ::1 in some environments and fail to connect.
    expect(buildLocalServerUrl(49321)).toBe('http://127.0.0.1:49321');
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
