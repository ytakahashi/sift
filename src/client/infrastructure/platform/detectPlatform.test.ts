import { describe, expect, it } from 'vitest';
import { detectPlatform } from './detectPlatform';

describe('detectPlatform', () => {
  it.each([
    [{ userAgentData: { platform: 'macOS' }, platform: 'Win32' }, 'mac'],
    [{ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' }, 'other'],
    [{ platform: 'MacIntel' }, 'mac'],
    [{ platform: 'MacPPC' }, 'mac'],
    [{ platform: 'Win32' }, 'other'],
    [{ platform: 'Linux x86_64' }, 'other'],
    [{ platform: '' }, 'other'],
  ] as const)('resolves %j to %s', (navigatorLike, expected) => {
    // Given / When / Then: no host navigator is read
    expect(detectPlatform(navigatorLike)).toBe(expected);
  });
});
