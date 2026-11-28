import { randomUUID } from 'node:crypto';
import { REVIEW_PARTICIPANT_HEADER } from '../server/contract/review-transport';
import { parseErrorResponse } from './http-json-client';
import { reviewUrl } from './review-http-client';

const CONNECTION_TIMEOUT_MS = 5_000;

type ReviewConnectionResult =
  | { kind: 'connected'; participantId: string }
  | { kind: 'rejected'; status: number; code?: string; message?: string }
  | { kind: 'unreachable' };

export interface ReviewPresence {
  connect(port: number, repoId: string): Promise<ReviewConnectionResult>;
  close(): void;
}

export function createReviewPresence(fetchImpl: typeof fetch = fetch): ReviewPresence {
  const participantId = randomUUID();
  const connections = new Map<
    string,
    { controller: AbortController; ready: Promise<ReviewConnectionResult> }
  >();
  let closed = false;

  return {
    async connect(port, repoId) {
      if (closed) {
        return { kind: 'unreachable' };
      }
      const url = `${reviewUrl(port, repoId)}/participants`;
      let connection = connections.get(url);
      if (!connection) {
        const controller = new AbortController();
        const cleanup = (): void => {
          controller.abort();
          if (connections.get(url)?.controller === controller) {
            connections.delete(url);
          }
        };
        const ready = openConnection(url, participantId, controller, cleanup, fetchImpl);
        connection = { controller, ready };
        connections.set(url, connection);
      }
      const result = await connection.ready;
      return closed ? { kind: 'unreachable' } : result;
    },
    close() {
      closed = true;
      for (const { controller } of connections.values()) {
        controller.abort();
      }
      connections.clear();
    },
  };
}

async function openConnection(
  url: string,
  participantId: string,
  controller: AbortController,
  cleanup: () => void,
  fetchImpl: typeof fetch,
): Promise<ReviewConnectionResult> {
  const timer = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
  let ready = false;
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { [REVIEW_PARTICIPANT_HEADER]: participantId },
      signal: controller.signal,
    });
    if (response.status !== 200) {
      const parsed = await parseErrorResponse(response);
      return parsed.kind === 'valid'
        ? { kind: 'rejected', status: parsed.status, code: parsed.code, message: parsed.message }
        : { kind: 'rejected', status: response.status };
    }
    if (!response.body) {
      return { kind: 'unreachable' };
    }
    const reader = response.body.getReader();
    // The server flushes the first bytes only after registering the participant.
    const first = await reader.read();
    if (first.done) {
      reader.releaseLock();
      return { kind: 'unreachable' };
    }
    ready = true;
    void keepReading(reader, cleanup);
    return { kind: 'connected', participantId };
  } catch (_error: unknown) {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
    if (!ready) {
      cleanup();
    }
  }
}

async function keepReading(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  cleanup: () => void,
): Promise<void> {
  try {
    while (!(await reader.read()).done) {
      // Keep the connection open across tool calls, consuming the server's keepalives.
    }
  } catch (_error: unknown) {
    // The next tool call can open a fresh stream after a transport failure.
  } finally {
    reader.releaseLock();
    cleanup();
  }
}
