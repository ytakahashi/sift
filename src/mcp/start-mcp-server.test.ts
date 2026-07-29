import type { McpServer } from '@modelcontextprotocol/server';
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { describe, expect, it, vi } from 'vitest';
import type { RegisterNotesToolsOptions } from './register-notes-tools';

const { mcpServerCtor, registerNotesToolsMock, serveStdioMock } = vi.hoisted(() => ({
  mcpServerCtor: vi.fn(),
  registerNotesToolsMock: vi.fn(),
  serveStdioMock: vi.fn(),
}));

vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: vi.fn().mockImplementation(function (serverInfo: unknown) {
    mcpServerCtor(serverInfo);
    // A fresh object per construction, so tests can tell instances apart.
    return { serverInfo };
  }),
}));

vi.mock('@modelcontextprotocol/server/stdio', () => ({
  serveStdio: serveStdioMock,
}));

// Tool registration itself is covered by register-notes-tools.test.ts; here it
// is stubbed so the options handed to it (notably the per-instance resolver)
// can be inspected directly.
vi.mock('./register-notes-tools', () => ({
  registerNotesTools: registerNotesToolsMock,
}));

// Building a lister reads the repository config path; stub it so this
// transport-wiring test never touches the real filesystem.
vi.mock('../server/index', () => ({
  createRegisteredRepositoryLister: vi.fn().mockReturnValue({
    findRegisteredRepositoryByPath: vi.fn(),
    listRegisteredRepositories: vi.fn(),
  }),
}));

const { startMcpServer } = await import('./start-mcp-server');
const { APP_INFO } = await import('../server/app-info');

type ServerFactory = () => McpServer;

interface ServeStdioOptionsUnderTest {
  onerror?: (error: Error) => void;
}

/**
 * Runs `startMcpServer` and hands back what it passed to `serveStdio`, so each
 * test can drive the factory the way the SDK does.
 */
function startAndCaptureFactory(repoPath: string): {
  resolveRepoRoot: ReturnType<typeof vi.fn>;
  factory: ServerFactory;
  serveStdioOptions: ServeStdioOptionsUnderTest;
} {
  const handle: StdioServerHandle = { close: vi.fn().mockResolvedValue(undefined) };
  serveStdioMock.mockReturnValue(handle);
  const resolveRepoRoot = vi.fn().mockReturnValue('/repo/sift');

  startMcpServer({ repoPath, resolveRepoRoot });

  const [factory, serveStdioOptions] = serveStdioMock.mock.calls.at(-1) as [
    ServerFactory,
    ServeStdioOptionsUnderTest,
  ];
  return { resolveRepoRoot, factory, serveStdioOptions };
}

function lastRegisterOptions(): RegisterNotesToolsOptions {
  return registerNotesToolsMock.mock.calls.at(-1)![1] as RegisterNotesToolsOptions;
}

describe('startMcpServer', () => {
  it('serves stdio from a server factory and returns the SDK connection handle', () => {
    // Given
    const handle: StdioServerHandle = { close: vi.fn().mockResolvedValue(undefined) };
    serveStdioMock.mockReturnValue(handle);

    // When
    const returned = startMcpServer({ repoPath: '/repo/sift', resolveRepoRoot: vi.fn() });

    // Then
    expect(serveStdioMock).toHaveBeenCalledWith(expect.any(Function), expect.any(Object));
    expect(returned).toBe(handle);
  });

  it('builds an McpServer with the app name/version and registers the Notes tools', () => {
    // Given
    const { factory, resolveRepoRoot } = startAndCaptureFactory('/repo/sift');

    // When
    const server = factory();

    // Then
    expect(mcpServerCtor).toHaveBeenCalledWith({ name: 'sift', version: APP_INFO.version });
    expect(registerNotesToolsMock).toHaveBeenCalledWith(
      server,
      expect.objectContaining({ repoPath: '/repo/sift' }),
    );
    // Building an instance must stay side-effect free: `serveStdio` discards
    // the instance it built for a `server/discover` probe when the client then
    // falls back to `initialize`.
    expect(resolveRepoRoot).not.toHaveBeenCalled();
  });

  it('gives every instance its own server and repo root resolver', () => {
    // Given
    const { factory } = startAndCaptureFactory('/repo/sift');

    // When
    // A probe-then-fallback opening builds two instances from the one factory.
    const probeServer = factory();
    const probeOptions = lastRegisterOptions();
    const pinnedServer = factory();
    const pinnedOptions = lastRegisterOptions();

    // Then
    expect(pinnedServer).not.toBe(probeServer);
    expect(pinnedOptions.repoRootResolver).not.toBe(probeOptions.repoRootResolver);
  });

  it('resolves the repo root lazily, and caches it per instance', () => {
    // Given
    const { factory, resolveRepoRoot } = startAndCaptureFactory('/repo/sift/nested');

    // When
    factory();
    const firstResolver = lastRegisterOptions().repoRootResolver;
    factory();
    const secondResolver = lastRegisterOptions().repoRootResolver;

    // Then
    expect(resolveRepoRoot).not.toHaveBeenCalled();
    expect(firstResolver.resolve()).toBe('/repo/sift');
    expect(resolveRepoRoot).toHaveBeenCalledExactlyOnceWith('/repo/sift/nested');
    // The second instance caches independently, so it resolves on its own
    // rather than reusing the first instance's cached root.
    expect(secondResolver.resolve()).toBe('/repo/sift');
    expect(resolveRepoRoot).toHaveBeenCalledTimes(2);
  });

  it('reports out-of-band errors on stderr, never on stdout', () => {
    // Given
    const { serveStdioOptions } = startAndCaptureFactory('/repo/sift');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = new Error('transport failed');

    // When
    serveStdioOptions.onerror?.(error);

    // Then
    expect(errorSpy).toHaveBeenCalledWith(error);
    expect(logSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});
