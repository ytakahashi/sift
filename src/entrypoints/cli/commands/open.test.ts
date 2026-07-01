import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedRepository } from '../../../domain/repository/repository';
import type { OpenCommandDependencies } from './open';
import { createOpenCommand } from './open';

function createDependencies(): OpenCommandDependencies {
  return {
    listRegisteredRepositories: vi.fn().mockResolvedValue([]),
    openApp: vi.fn().mockResolvedValue(undefined),
    openBrowser: vi.fn(),
    resolveRepositoryIdForOpen: vi.fn().mockResolvedValue('repo-123'),
    selectRepository: vi.fn().mockResolvedValue(null),
    startServer: vi.fn().mockResolvedValue({ owned: true, url: 'http://127.0.0.1:49321' }),
  };
}

function createRepository(overrides: Partial<ResolvedRepository> = {}): ResolvedRepository {
  return {
    id: 'sift-abc123',
    name: 'sift',
    path: '/repo/sift',
    ...overrides,
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
    expect(console.log).toHaveBeenCalledWith('Server started at http://127.0.0.1:49321');
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
    expect(console.log).toHaveBeenCalledWith('Browser opened.');
  });

  it('does not print "Server started" when reusing an already-running server', async () => {
    // Given
    const dependencies = createDependencies();
    vi.mocked(dependencies.startServer).mockResolvedValue({
      owned: false,
      url: 'http://127.0.0.1:49321',
    });
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync([], { from: 'user' });

    // Then
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Server started'));
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
    expect(console.log).toHaveBeenCalledWith('Browser opened.');
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
    expect(console.log).toHaveBeenCalledWith('Browser opened.');
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
    expect(console.log).toHaveBeenCalledWith('Browser opened.');
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
    expect(console.log).toHaveBeenCalledWith('Browser opened.');
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
    expect(console.log).toHaveBeenCalledWith('Browser opened.');
  });

  it('opens the browser with the interactively selected repository when -i is provided', async () => {
    // Given
    const dependencies = createDependencies();
    const repositories = [createRepository({ id: 'repo-a' }), createRepository({ id: 'repo-b' })];
    vi.mocked(dependencies.listRegisteredRepositories).mockResolvedValue(repositories);
    vi.mocked(dependencies.selectRepository).mockResolvedValue(repositories[1]);
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync(['-i'], { from: 'user' });

    // Then
    expect(dependencies.listRegisteredRepositories).toHaveBeenCalledOnce();
    expect(dependencies.selectRepository).toHaveBeenCalledWith(repositories);
    expect(dependencies.resolveRepositoryIdForOpen).not.toHaveBeenCalled();
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-b');
    expect(console.log).toHaveBeenCalledWith('Browser opened.');
  });

  it('opens the macOS app with the interactively selected repository when -i --app is provided', async () => {
    // Given
    const dependencies = createDependencies();
    const repositories = [createRepository({ id: 'repo-a' })];
    vi.mocked(dependencies.listRegisteredRepositories).mockResolvedValue(repositories);
    vi.mocked(dependencies.selectRepository).mockResolvedValue(repositories[0]);
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync(['-i', '--app'], { from: 'user' });

    // Then
    expect(dependencies.selectRepository).toHaveBeenCalledWith(repositories);
    expect(dependencies.openApp).toHaveBeenCalledWith('repo-a');
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('rejects -i together with a path argument before side effects', async () => {
    // Given
    const dependencies = createDependencies();
    const command = createOpenCommand(dependencies);

    // When & Then
    await expect(command.parseAsync(['-i', '/path'], { from: 'user' })).rejects.toThrow(
      'Cannot specify both a path and --interactive.',
    );
    expect(dependencies.listRegisteredRepositories).not.toHaveBeenCalled();
    expect(dependencies.selectRepository).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('prints a message and exits without side effects when no repositories are registered', async () => {
    // Given
    const dependencies = createDependencies();
    vi.mocked(dependencies.listRegisteredRepositories).mockResolvedValue([]);
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync(['-i'], { from: 'user' });

    // Then
    expect(console.log).toHaveBeenCalledWith('No repositories are registered.');
    expect(dependencies.selectRepository).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('exits without side effects when the interactive selection is cancelled', async () => {
    // Given
    const dependencies = createDependencies();
    vi.mocked(dependencies.listRegisteredRepositories).mockResolvedValue([createRepository()]);
    vi.mocked(dependencies.selectRepository).mockResolvedValue(null);
    const command = createOpenCommand(dependencies);

    // When
    await command.parseAsync(['-i'], { from: 'user' });

    // Then
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });
});
