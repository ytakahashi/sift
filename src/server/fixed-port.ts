export const DEFAULT_PORT = 49321;

// The server binds this host exclusively (see listenOnPort in index.ts); the URL builder
// below must target the same host so probes never race a "localhost" resolving to a
// different address (e.g. IPv6 ::1) than the one the server actually listens on.
export const LOOPBACK_HOST = '127.0.0.1';

export function buildLocalServerUrl(port: number): string {
  return `http://${LOOPBACK_HOST}:${port}`;
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
