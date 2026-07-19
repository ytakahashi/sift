import { APP_INFO } from './app-info';

export const DEFAULT_PORT = 49321;
export const SIFT_HEALTH_PRODUCT = APP_INFO.name;
export const SIFT_HEALTH_VERSION = APP_INFO.version;
export const NOTES_V1_CAPABILITY = 'notes-v1';
export const SIFT_HEALTH_CAPABILITIES: readonly string[] = [NOTES_V1_CAPABILITY];

// The server binds this host exclusively (see listenOnPort in index.ts); the URL builder
// below must target the same host so probes never race a "localhost" resolving to a
// different address (e.g. IPv6 ::1) than the one the server actually listens on.
export const LOOPBACK_HOST = '127.0.0.1';

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

export function buildLocalServerUrl(port: number): string {
  return `http://${LOOPBACK_HOST}:${port}`;
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

/**
 * Validates the PORT environment variable strictly (decimal integer, 1..65535) instead of
 * `parseInt`, which silently accepts values with trailing garbage (e.g. "49321x").
 */
export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PORT;
  if (raw === undefined) {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535) {
    throw new Error(
      `Invalid PORT environment variable: "${raw}". Expected a decimal integer between 1 and 65535.`,
    );
  }

  return Number(raw);
}
