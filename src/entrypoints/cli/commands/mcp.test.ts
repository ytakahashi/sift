import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpCommandDependencies } from './mcp';
import { createMcpCommand } from './mcp';

function createDependencies(): McpCommandDependencies {
  return {
    resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
    startMcpServer: vi.fn().mockResolvedValue({
      server: {},
      repoRootResolver: { resolve: vi.fn() },
    }),
  };
}

describe('createMcpCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('starts the MCP server with the given --repo path', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createMcpCommand(dependencies);

    // When
    await command.parseAsync(['--repo', '/path'], { from: 'user' });

    // Then
    expect(dependencies.startMcpServer).toHaveBeenCalledWith({
      repoPath: '/path',
      resolveRepoRoot: dependencies.resolveRepoRoot,
    });
  });

  it('falls back to the current working directory when --repo is not given', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createMcpCommand(dependencies);
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/cwd/repo');

    // When
    await command.parseAsync([], { from: 'user' });

    // Then
    expect(dependencies.startMcpServer).toHaveBeenCalledWith({
      repoPath: '/cwd/repo',
      resolveRepoRoot: dependencies.resolveRepoRoot,
    });
    cwdSpy.mockRestore();
  });

  it('never writes to stdout, which is reserved for JSON-RPC framing', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createMcpCommand(dependencies);

    // When
    await command.parseAsync([], { from: 'user' });

    // Then
    expect(console.log).not.toHaveBeenCalled();
  });
});
