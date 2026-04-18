import type { SessionInfo } from '../../../domain/session/types';
import type { SessionReader } from '../../application/ports';

export const httpSessionReader: SessionReader = {
  async fetchSession(): Promise<SessionInfo> {
    const res = await fetch('/api/session');
    if (!res.ok) {
      throw new Error(`Failed to fetch session: ${res.statusText}`);
    }
    return (await res.json()) as SessionInfo;
  },
};
