import { describe, expect, it, vi } from 'vitest';

const { connectMock, mcpServerCtor, stdioTransportCtor } = vi.hoisted(() => ({
  connectMock: vi.fn().mockResolvedValue(undefined),
  mcpServerCtor: vi.fn(),
  stdioTransportCtor: vi.fn(),
}));

vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: vi.fn().mockImplementation(function (serverInfo: unknown) {
    mcpServerCtor(serverInfo);
    return { connect: connectMock };
  }),
}));

vi.mock('@modelcontextprotocol/server/stdio', () => ({
  StdioServerTransport: vi.fn().mockImplementation(function () {
    stdioTransportCtor();
    return {};
  }),
}));

const { startMcpServer } = await import('./start-mcp-server');
const { APP_INFO } = await import('../server/app-info');

describe('startMcpServer', () => {
  it('connects an McpServer over a stdio transport using the app name/version', async () => {
    // Given
    const resolveRepoRoot = vi.fn().mockReturnValue('/repo/sift');

    // When
    const handle = await startMcpServer({ repoPath: '/repo/sift', resolveRepoRoot });

    // Then
    expect(mcpServerCtor).toHaveBeenCalledWith({ name: APP_INFO.name, version: APP_INFO.version });
    expect(stdioTransportCtor).toHaveBeenCalledOnce();
    expect(connectMock).toHaveBeenCalledOnce();
    expect(handle.server).toBeDefined();
  });

  it('returns a repo root resolver that lazily resolves the given repoPath', async () => {
    // Given
    const resolveRepoRoot = vi.fn().mockReturnValue('/repo/sift');

    // When
    const handle = await startMcpServer({ repoPath: '/repo/sift/nested', resolveRepoRoot });

    // Then
    expect(resolveRepoRoot).not.toHaveBeenCalled();
    expect(handle.repoRootResolver.resolve()).toBe('/repo/sift');
    expect(resolveRepoRoot).toHaveBeenCalledWith('/repo/sift/nested');
  });
});
