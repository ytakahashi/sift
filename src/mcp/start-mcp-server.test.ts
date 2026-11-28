import type { McpServer } from '@modelcontextprotocol/server';
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolveToolTarget } from './tool-target';

const {
  mcpServerCtor,
  registerNotesToolsMock,
  registerReviewToolsMock,
  loadReviewSkillsMock,
  serveStdioMock,
} = vi.hoisted(() => ({
  mcpServerCtor: vi.fn(),
  registerNotesToolsMock: vi.fn(),
  registerReviewToolsMock: vi.fn(),
  loadReviewSkillsMock: vi.fn(),
  serveStdioMock: vi.fn(),
}));

vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: vi.fn().mockImplementation(function (serverInfo: unknown, options: unknown) {
    mcpServerCtor(serverInfo, options);
    // A fresh object per construction, so tests can tell instances apart.
    return { serverInfo, server: {} };
  }),
}));

vi.mock('@modelcontextprotocol/server/stdio', () => ({
  serveStdio: serveStdioMock,
}));

vi.mock('./register-notes-tools', () => ({
  registerNotesTools: registerNotesToolsMock,
}));

vi.mock('./register-review-tools', () => ({
  registerReviewTools: registerReviewToolsMock,
}));

vi.mock('./review-skills', () => ({
  loadReviewSkills: loadReviewSkillsMock,
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
async function startAndCaptureFactory(repoPath: string): Promise<{
  resolveRepoRoot: ReturnType<typeof vi.fn>;
  factory: ServerFactory;
  serveStdioOptions: ServeStdioOptionsUnderTest;
}> {
  const handle: StdioServerHandle = { close: vi.fn().mockResolvedValue(undefined) };
  serveStdioMock.mockReturnValue(handle);
  const resolveRepoRoot = vi.fn().mockReturnValue('/repo/sift');

  await startMcpServer({
    repoPath,
    resolveRepoRoot,
    findRegisteredRepositoryByPath: vi.fn().mockResolvedValue(null),
  });

  const [factory, serveStdioOptions] = serveStdioMock.mock.calls.at(-1) as [
    ServerFactory,
    ServeStdioOptionsUnderTest,
  ];
  return { resolveRepoRoot, factory, serveStdioOptions };
}

function lastResolveTarget(): ResolveToolTarget {
  return registerNotesToolsMock.mock.calls.at(-1)![2] as ResolveToolTarget;
}

describe('startMcpServer', () => {
  const attach = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    loadReviewSkillsMock.mockResolvedValue({ attach });
  });

  it('serves stdio from a server factory and returns the SDK connection handle', async () => {
    // Given
    const handle: StdioServerHandle = { close: vi.fn().mockResolvedValue(undefined) };
    serveStdioMock.mockReturnValue(handle);

    // When
    const returned = await startMcpServer({
      repoPath: '/repo/sift',
      resolveRepoRoot: vi.fn(),
      findRegisteredRepositoryByPath: vi.fn(),
    });

    // Then
    expect(serveStdioMock).toHaveBeenCalledWith(expect.any(Function), expect.any(Object));
    expect(returned).toBe(handle);
  });

  it('builds an McpServer with the app name/version and registers Notes and Review tools with the same target resolver', async () => {
    // Given
    const { factory, resolveRepoRoot } = await startAndCaptureFactory('/repo/sift');

    // When
    const server = factory();

    // Then
    expect(mcpServerCtor).toHaveBeenCalledWith(
      { name: 'sift', version: APP_INFO.version },
      expect.objectContaining({ instructions: expect.stringContaining('wait_for_turn') }),
    );
    expect(registerNotesToolsMock).toHaveBeenCalledWith(
      server,
      expect.objectContaining({ getNotes: expect.any(Function) }),
      lastResolveTarget(),
    );
    expect(registerReviewToolsMock).toHaveBeenCalledWith(
      server,
      expect.objectContaining({
        waitForReview: expect.any(Function),
        connect: expect.any(Function),
      }),
      lastResolveTarget(),
    );
    // Building an instance must stay side-effect free: `serveStdio` discards
    // the instance it built for a `server/discover` probe when the client then
    // falls back to `initialize`.
    expect(resolveRepoRoot).not.toHaveBeenCalled();
  });

  it('gives every instance its own server and repo root resolver', async () => {
    // Given
    const { factory } = await startAndCaptureFactory('/repo/sift');

    // When
    // A probe-then-fallback opening builds two instances from the one factory.
    const probeServer = factory();
    const probeResolveTarget = lastResolveTarget();
    const pinnedServer = factory();
    const pinnedResolveTarget = lastResolveTarget();

    // Then
    expect(pinnedServer).not.toBe(probeServer);
    expect(pinnedResolveTarget).not.toBe(probeResolveTarget);
  });

  it('loads one catalog and attaches it to both the probe and pinned server', async () => {
    // Given
    const { factory } = await startAndCaptureFactory('/repo/sift');

    // When
    const probeServer = factory();
    const pinnedServer = factory();

    // Then
    expect(loadReviewSkillsMock).toHaveBeenCalledOnce();
    expect(attach.mock.calls).toEqual([[probeServer], [pinnedServer]]);
  });

  it('resolves the repo root lazily, and caches it per instance', async () => {
    // Given
    const { factory, resolveRepoRoot } = await startAndCaptureFactory('/repo/sift/nested');

    // When
    factory();
    const firstResolver = lastResolveTarget();
    factory();
    const secondResolver = lastResolveTarget();

    // Then
    expect(resolveRepoRoot).not.toHaveBeenCalled();
    await firstResolver();
    await firstResolver();
    expect(resolveRepoRoot).toHaveBeenCalledExactlyOnceWith('/repo/sift/nested');
    // The second instance caches independently, so it resolves on its own
    // rather than reusing the first instance's cached root.
    await secondResolver();
    expect(resolveRepoRoot).toHaveBeenCalledTimes(2);
  });

  it('reports out-of-band errors on stderr, never on stdout', async () => {
    // Given
    const { serveStdioOptions } = await startAndCaptureFactory('/repo/sift');
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
