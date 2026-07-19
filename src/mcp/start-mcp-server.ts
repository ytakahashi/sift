import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { APP_INFO } from '../server/app-info';
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
 * Connects an MCP server to the current process's stdio. Tools are
 * registered separately (`list_notes`/`add_note`); this only sets up the
 * transport and the lazy repo-root resolver those tools will share.
 *
 * `StdioServerTransport` defaults to serving 2025-era (legacy) openings,
 * which matches the current MCP host compatibility target.
 */
export async function startMcpServer(options: StartMcpServerOptions): Promise<McpServerHandle> {
  const repoRootResolver = createRepoRootResolver(options.repoPath, options.resolveRepoRoot);
  const server = new McpServer({ name: APP_INFO.name, version: APP_INFO.version });

  await server.connect(new StdioServerTransport());

  return { server, repoRootResolver };
}
