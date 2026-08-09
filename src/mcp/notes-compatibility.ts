import { probeLocalServer, type HealthFetch } from '../server/health-probe';
import { NOTES_V2_CAPABILITY } from '../server/contract/health-contract';

export type NotesApiCompatibility =
  | { kind: 'compatible' }
  | { kind: 'unreachable' }
  | { kind: 'incompatible-product' }
  | { kind: 'capability-missing' };

/**
 * Checks, ahead of any Notes API call, whether the local server is a Sift
 * server speaking the same Notes contract as this build. Distinguishes "no
 * server" from "some other product" from "a Sift server on a different Notes
 * version" so each can get its own actionable guidance instead of one generic
 * error.
 */
export async function checkNotesApiCompatibility(
  port: number,
  fetchHealth: HealthFetch = fetch,
): Promise<NotesApiCompatibility> {
  const probe = await probeLocalServer(port, fetchHealth);

  switch (probe.kind) {
    case 'unreachable':
      return { kind: 'unreachable' };
    case 'other':
      return { kind: 'incompatible-product' };
    case 'sift':
      return probe.capabilities.includes(NOTES_V2_CAPABILITY)
        ? { kind: 'compatible' }
        : { kind: 'capability-missing' };
  }
}
