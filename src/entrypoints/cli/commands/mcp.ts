import { Command } from 'commander';
import type { ResolvedRepository } from '../../../domain/repository/repository';
import type { McpServerHandle, StartMcpServerOptions } from '../../../mcp/start-mcp-server';

export interface McpCommandDependencies {
  resolveRepoRoot: (targetPath: string) => string;
  findRegisteredRepositoryByPath: (path: string) => Promise<ResolvedRepository | null>;
  startMcpServer: (options: StartMcpServerOptions) => McpServerHandle;
}

interface McpCommandOptions {
  repo?: string;
}

export function createMcpCommand(dependencies: McpCommandDependencies): Command {
  return new Command('mcp')
    .description('Start the MCP server exposing Notes to AI agent hosts over stdio')
    .option('--repo <path>', 'Repository to operate on (defaults to the current directory)')
    .action((options: McpCommandOptions) => {
      // The stdio transport uses stdout exclusively for JSON-RPC framing, so this
      // action must never console.log; even one stray byte breaks the protocol.
      // The returned handle is intentionally dropped: the connection lives as
      // long as the process, which exits when stdin closes.
      const repoPath = options.repo ?? process.cwd();
      dependencies.startMcpServer({
        repoPath,
        resolveRepoRoot: dependencies.resolveRepoRoot,
        findRegisteredRepositoryByPath: dependencies.findRegisteredRepositoryByPath,
      });
    });
}
