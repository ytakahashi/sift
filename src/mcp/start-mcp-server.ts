import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio, type StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { APP_INFO } from '../server/app-info';
import { resolvePort } from '../server/fixed-port';
import { createRegisteredRepositoryLister } from '../server/index';
import { checkNotesApiCompatibility } from './notes-compatibility';
import { createNote, getNotes } from './notes-http-client';
import { registerNotesTools } from './register-notes-tools';
import { createRepoRootResolver } from './repo-target';

export interface StartMcpServerOptions {
  /** `--repo <path>` value, or `process.cwd()` when not given. */
  repoPath: string;
  resolveRepoRoot: (targetPath: string) => string;
}

/**
 * Handle for the stdio connection: `close()` tears down the pinned server
 * instance and the underlying transport.
 */
export type McpServerHandle = StdioServerHandle;

/**
 * Builds one fully registered server instance.
 *
 * `serveStdio` calls this once per connection, and twice when a client opens
 * with a `server/discover` probe and then falls back to `initialize`: the
 * probe instance is closed and discarded before the legacy one is built.
 * Every instance therefore owns its own `RepoRootResolver` (resolution state
 * is never shared across instances), and this function must stay free of
 * side effects so that a discarded instance leaves nothing behind.
 */
function createNotesServer(options: StartMcpServerOptions): McpServer {
  const server = new McpServer({ name: APP_INFO.productName, version: APP_INFO.version });

  registerNotesTools(server, {
    repoPath: options.repoPath,
    repoRootResolver: createRepoRootResolver(options.repoPath, options.resolveRepoRoot),
    findRegisteredRepositoryByPath:
      createRegisteredRepositoryLister().findRegisteredRepositoryByPath,
    resolvePort,
    checkNotesApiCompatibility,
    getNotes,
    createNote,
  });

  return server;
}

/**
 * Serves the Notes tools over the current process's stdio to both protocol
 * eras: the 2025 `initialize` handshake and the 2026-07-28 per-request
 * envelope. `serveStdio` owns the era decision — the opening message selects
 * the era, and one instance from the factory is pinned for the connection.
 */
export function startMcpServer(options: StartMcpServerOptions): McpServerHandle {
  return serveStdio(() => createNotesServer(options), {
    // stdout carries JSON-RPC framing exclusively, so out-of-band errors
    // (transport failures, throws while building or connecting an instance,
    // failures while discarding a probe instance) are reported on stderr.
    // Without this callback the SDK drops them silently.
    onerror: (error: Error): void => {
      console.error(error);
    },
  });
}
