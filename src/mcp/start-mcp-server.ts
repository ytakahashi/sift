import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { APP_INFO } from '../server/app-info';
import { resolvePort } from '../server/fixed-port';
import { createRegisteredRepositoryLister } from '../server/index';
import { checkNotesApiCompatibility } from './notes-compatibility';
import { createNote, getNotes } from './notes-http-client';
import { registerNotesTools } from './register-notes-tools';
import { createRepoRootResolver, type RepoRootResolver } from './repo-target';

export interface StartMcpServerOptions {
  /** `--repo <path>` value, or `process.cwd()` when not given. */
  repoPath: string;
  resolveRepoRoot: (targetPath: string) => string;
}

export interface McpServerHandle {
  server: McpServer;
  repoRootResolver: RepoRootResolver;
}

/**
 * Builds the McpServer, registers the Notes tools against it, and connects
 * it to the current process's stdio.
 *
 * `StdioServerTransport` defaults to serving 2025-era (legacy) openings,
 * which matches the current MCP host compatibility target.
 */
export async function startMcpServer(options: StartMcpServerOptions): Promise<McpServerHandle> {
  const repoRootResolver = createRepoRootResolver(options.repoPath, options.resolveRepoRoot);
  const server = new McpServer({ name: APP_INFO.productName, version: APP_INFO.version });

  registerNotesTools(server, {
    repoPath: options.repoPath,
    repoRootResolver,
    findRegisteredRepositoryByPath:
      createRegisteredRepositoryLister().findRegisteredRepositoryByPath,
    resolvePort,
    checkNotesApiCompatibility,
    getNotes,
    createNote,
  });

  await server.connect(new StdioServerTransport());

  return { server, repoRootResolver };
}
