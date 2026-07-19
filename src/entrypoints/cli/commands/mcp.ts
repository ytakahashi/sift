import { Command } from 'commander';
import type { McpServerHandle, StartMcpServerOptions } from '../../../mcp/start-mcp-server';

export interface McpCommandDependencies {
  resolveRepoRoot: (targetPath: string) => string;
  startMcpServer: (options: StartMcpServerOptions) => Promise<McpServerHandle>;
}

interface McpCommandOptions {
  repo?: string;
}

export function createMcpCommand(dependencies: McpCommandDependencies): Command {
  return new Command('mcp')
    .description('Start the MCP server exposing Notes to AI agent hosts over stdio')
    .option('--repo <path>', 'Repository to operate on (defaults to the current directory)')
    .action(async (options: McpCommandOptions) => {
      // The stdio transport uses stdout exclusively for JSON-RPC framing, so this
      // action must never console.log; even one stray byte breaks the protocol.
      const repoPath = options.repo ?? process.cwd();
      await dependencies.startMcpServer({
        repoPath,
        resolveRepoRoot: dependencies.resolveRepoRoot,
      });
    });
}
