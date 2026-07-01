import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenCommandDependencies } from './open';
import { createOpenCommand } from './open';

function createDependencies(): OpenCommandDependencies {
  return {
    openApp: vi.fn().mockResolvedValue(undefined),
    openBrowser: vi.fn(),
    resolveRepositoryIdForOpen: vi.fn().mockResolvedValue('repo-123'),
    startServer: vi.fn().mockResolvedValue('http://127.0.0.1:49321'),
  };
}

describe('createOpenCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('opens the browser by default (no options)', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync([], { from: 'user' });

    // Then
    expect(dependencies.resolveRepositoryIdForOpen).toHaveBeenCalledWith(undefined);
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
  });

  it('opens the browser when --browser is provided explicitly', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync(['--browser'], { from: 'user' });

    // Then
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
  });

  it('opens the browser when -b is provided', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync(['-b'], { from: 'user' });

    // Then
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
  });

  it.each([['--app'], ['-a']])(
    'opens the macOS app with the resolved repository ID when %s is provided',
    async (option) => {
      // Given
      const dependencies = createDependencies();
      const command = createOpenCommand(dependencies);

      // When
      await command.parseAsync([option], { from: 'user' });

      // Then
      expect(dependencies.openApp).toHaveBeenCalledWith('repo-123');
      expect(dependencies.startServer).not.toHaveBeenCalled();
      expect(dependencies.openBrowser).not.toHaveBeenCalled();
      expect(
        vi.mocked(dependencies.resolveRepositoryIdForOpen).mock.invocationCallOrder[0],
      ).toBeLessThan(vi.mocked(dependencies.openApp).mock.invocationCallOrder[0]);
    },
  );

  it('resolves the given path argument', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync(['/path'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepositoryIdForOpen).toHaveBeenCalledWith('/path');
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
  });

  it('rejects --app together with --browser before side effects', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createOpenCommand(dependencies);

    // When & Then
    await expect(command.parseAsync(['--app', '--browser'], { from: 'user' })).rejects.toThrow(
      'Cannot specify both --app and --browser.',
    );
    expect(dependencies.resolveRepositoryIdForOpen).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('propagates the failure instead of opening anything when resolution fails for an explicit path', async () => {
    // Given
    const dependencies = createDependencies();
    const resolveError = new Error('Failed to resolve repository at /path: Not a git repository');
    vi.mocked(dependencies.resolveRepositoryIdForOpen).mockRejectedValue(resolveError);
    const command = createOpenCommand(dependencies);

    // When & Then
    await expect(command.parseAsync(['/path'], { from: 'user' })).rejects.toBe(resolveError);
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('opens the base URL when the target path is outside a registered repository', async () => {
    // Given
    const dependencies = createDependencies();
    vi.mocked(dependencies.resolveRepositoryIdForOpen).mockResolvedValue(null);
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync([], { from: 'user' });

    // Then
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321');
  });
});
