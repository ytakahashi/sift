import { APP_INFO } from './app-info';
import { buildLocalServerUrl } from './fixed-port';

export const SIFT_HEALTH_PRODUCT = APP_INFO.name;
export const SIFT_HEALTH_VERSION = APP_INFO.version;
export const NOTES_V1_CAPABILITY = 'notes-v1';
export const SIFT_HEALTH_CAPABILITIES: readonly string[] = [NOTES_V1_CAPABILITY];

export type ExistingServerStatus = 'sift' | 'other' | 'unreachable';

/** Identity fields parsed from a trusted `{ kind: 'sift' }` health response. */
export interface SiftHealthIdentity {
  version: string;
  capabilities: readonly string[];
}

/**
 * Discriminated probe result shared by callers that only need to know whether a Sift
 * server owns the port (checkExistingSiftServer) and future MCP callers that also need
 * `capabilities` to decide whether the server satisfies a given tool contract.
 */
export type LocalServerProbe =
  | { kind: 'unreachable' }
  | { kind: 'other' }
  | ({ kind: 'sift' } & SiftHealthIdentity);

interface HealthFetchResponse {
  json: () => Promise<unknown>;
  ok: boolean;
}

export type HealthFetch = (url: string) => Promise<HealthFetchResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Parses an already-fetched health response body. `capabilities` absence is treated as a
 * pre-capabilities Sift server and normalized to an empty array; a `capabilities` field
 * present with the wrong shape is treated as an untrustworthy response instead, so a
 * legacy server is never confused with a malformed one.
 */
function parseSiftHealthIdentity(body: unknown): SiftHealthIdentity | null {
  if (!isRecord(body) || body.product !== SIFT_HEALTH_PRODUCT) {
    return null;
  }
  if (typeof body.version !== 'string') {
    return null;
  }
  if (body.capabilities === undefined) {
    return { version: body.version, capabilities: [] };
  }
  if (!isStringArray(body.capabilities)) {
    return null;
  }
  return { version: body.version, capabilities: body.capabilities };
}

export async function probeLocalServer(
  port: number,
  fetchHealth: HealthFetch = fetch,
): Promise<LocalServerProbe> {
  let response: HealthFetchResponse;
  try {
    response = await fetchHealth(`${buildLocalServerUrl(port)}/api/health`);
  } catch (_error: unknown) {
    return { kind: 'unreachable' };
  }

  if (!response.ok) {
    return { kind: 'other' };
  }

  try {
    const identity = parseSiftHealthIdentity(await response.json());
    return identity ? { kind: 'sift', ...identity } : { kind: 'other' };
  } catch (_error: unknown) {
    return { kind: 'other' };
  }
}

export async function checkExistingSiftServer(
  port: number,
  fetchHealth: HealthFetch = fetch,
): Promise<ExistingServerStatus> {
  const probe = await probeLocalServer(port, fetchHealth);
  return probe.kind;
}
