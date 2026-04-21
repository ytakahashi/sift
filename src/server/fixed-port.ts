export const DEFAULT_PORT = 49321;
export const SIFT_HEALTH_PRODUCT = 'sift';
export const SIFT_HEALTH_VERSION = '1.0.0';

export type ExistingServerStatus = 'sift' | 'other' | 'unreachable';

interface HealthFetchResponse {
  json: () => Promise<unknown>;
  ok: boolean;
}

export type HealthFetch = (url: string) => Promise<HealthFetchResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildLocalServerUrl(port: number): string {
  return `http://localhost:${port}`;
}

export async function checkExistingSiftServer(
  port: number,
  fetchHealth: HealthFetch = fetch,
): Promise<ExistingServerStatus> {
  let response: HealthFetchResponse;
  try {
    response = await fetchHealth(`${buildLocalServerUrl(port)}/api/health`);
  } catch {
    return 'unreachable';
  }

  if (!response.ok) {
    return 'other';
  }

  try {
    const body = await response.json();
    return isRecord(body) && body.product === SIFT_HEALTH_PRODUCT ? 'sift' : 'other';
  } catch {
    return 'other';
  }
}
