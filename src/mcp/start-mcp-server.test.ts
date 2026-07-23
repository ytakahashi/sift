import { describe, expect, it, vi } from 'vitest';

const { connectMock, mcpServerCtor, registerToolMock, stdioTransportCtor } = vi.hoisted(() => ({
  connectMock: vi.fn().mockResolvedValue(undefined),
  mcpServerCtor: vi.fn(),
  registerToolMock: vi.fn(),
  stdioTransportCtor: vi.fn(),
}));

vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: vi.fn().mockImplementation(function (serverInfo: unknown) {
    mcpServerCtor(serverInfo);
    return { connect: connectMock, registerTool: registerToolMock };
  }),
}));

vi.mock('@modelcontextprotocol/server/stdio', () => ({
  StdioServerTransport: vi.fn().mockImplementation(function () {
    stdioTransportCtor();
    return {};
  }),
}));

// Registering tools reads the repository config to build a lister; stub it
// so this transport-wiring test never touches the real filesystem.
vi.mock('../server/index', () => ({
  createRegisteredRepositoryLister: vi.fn().mockReturnValue({
    findRegisteredRepositoryByPath: vi.fn(),
    listRegisteredRepositories: vi.fn(),
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
    expect(mcpServerCtor).toHaveBeenCalledWith({ name: 'sift', version: APP_INFO.version });
    expect(registerToolMock).toHaveBeenCalledWith(
      'list_notes',
      expect.any(Object),
      expect.any(Function),
    );
    expect(registerToolMock).toHaveBeenCalledWith(
      'add_note',
      expect.any(Object),
      expect.any(Function),
    );
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
