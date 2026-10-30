import type { KeyboardPlatform } from '../../application/keyboard-shortcuts/keyboard-platform';

interface NavigatorLike {
  userAgentData?: { platform: string };
  platform: string;
}

export function detectPlatform(navigatorLike: NavigatorLike): KeyboardPlatform {
  const platform = navigatorLike.userAgentData?.platform ?? navigatorLike.platform;
  return /^mac/i.test(platform) ? 'mac' : 'other';
}
