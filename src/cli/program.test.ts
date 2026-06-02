import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommanderError, type Command } from 'commander';
import type { CliDependencies } from './program';
import { createCliProgram } from './program';

function createDependencies(): {
  addRepository: ReturnType<typeof vi.fn>;
  dependencies: CliDependencies;
} {
  const addRepository = vi.fn().mockResolvedValue({
    id: 'sift-repo',
    name: 'sift',
    path: '/repo/sift',
  });

  return {
    addRepository,
    dependencies: {
      createRepositoryConfigUpdater: vi.fn(() => ({
        addRepository,
      })),
      openApp: vi.fn().mockResolvedValue(undefined),
      openBrowser: vi.fn(),
      resolveInitialRepositoryIdForLaunch: vi.fn().mockResolvedValue('repo-123'),
      resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
      startServer: vi.fn().mockResolvedValue('http://127.0.0.1:49321'),
    },
  };
}

function createTestProgram(dependencies: CliDependencies): Command {
  const program = createCliProgram(dependencies);
  program.exitOverride();
  program.configureOutput({
    writeErr: () => {},
    writeOut: () => {},
  });
  return program;
}

describe('createCliProgram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('opens the browser when --browser is provided', async () => {
    // Given
    const { dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['--browser'], { from: 'user' });

    // Then
    expect(dependencies.resolveInitialRepositoryIdForLaunch).toHaveBeenCalledOnce();
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
  });

  it('starts the server and prints the browser URL by default', async () => {
    // Given
    const { dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync([], { from: 'user' });

    // Then
    expect(dependencies.resolveInitialRepositoryIdForLaunch).not.toHaveBeenCalled();
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith('Server started at http://127.0.0.1:49321');
    expect(console.log).toHaveBeenCalledWith(
      'Open http://127.0.0.1:49321 in your browser to view the diff.',
    );
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('opens the browser when -b is provided', async () => {
    // Given
    const { dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['-b'], { from: 'user' });

    // Then
    expect(dependencies.resolveInitialRepositoryIdForLaunch).toHaveBeenCalledOnce();
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
  });

  it('opens the macOS app with the resolved repository ID when --app is provided', async () => {
    // Given
    const { dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['--app'], { from: 'user' });

    // Then
    expect(dependencies.resolveInitialRepositoryIdForLaunch).toHaveBeenCalledOnce();
    expect(dependencies.openApp).toHaveBeenCalledWith('repo-123');
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
    expect(
      vi.mocked(dependencies.resolveInitialRepositoryIdForLaunch).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(dependencies.openApp).mock.invocationCallOrder[0]);
  });

  it('adds the resolved repository path when --add receives an explicit value', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    vi.mocked(dependencies.resolveRepoRoot).mockReturnValue('/resolved/repo');
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['--add', '/path'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).toHaveBeenCalledWith('/path');
    expect(addRepository).toHaveBeenCalledWith('/resolved/repo');
    expect(dependencies.startServer).toHaveBeenCalledOnce();
  });

  it('adds the resolved current directory when --add is bare', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    vi.mocked(dependencies.resolveRepoRoot).mockReturnValue('/resolved/current-directory');
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['--add'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).toHaveBeenCalledWith('.');
    expect(addRepository).toHaveBeenCalledWith('/resolved/current-directory');
    expect(dependencies.startServer).toHaveBeenCalledOnce();
  });

  it('rejects --app together with --browser before side effects', async () => {
    // Given
    const { dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When & Then
    await expect(program.parseAsync(['--app', '--browser'], { from: 'user' })).rejects.toThrow(
      'Cannot specify both --app and --browser.',
    );
    expect(dependencies.resolveInitialRepositoryIdForLaunch).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('rejects --add together with --app before side effects', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When & Then
    await expect(program.parseAsync(['--add', '/path', '--app'], { from: 'user' })).rejects.toThrow(
      'Cannot specify --add together with --app or --browser.',
    );
    expect(dependencies.resolveRepoRoot).not.toHaveBeenCalled();
    expect(addRepository).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
  });

  it('rejects --add together with --browser before side effects', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When & Then
    await expect(program.parseAsync(['--add', '--browser'], { from: 'user' })).rejects.toThrow(
      'Cannot specify --add together with --app or --browser.',
    );
    expect(dependencies.resolveRepoRoot).not.toHaveBeenCalled();
    expect(addRepository).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('opens the base URL when --browser is provided outside a registered repository', async () => {
    // Given
    const { dependencies } = createDependencies();
    vi.mocked(dependencies.resolveInitialRepositoryIdForLaunch).mockResolvedValue(null);
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['--browser'], { from: 'user' });

    // Then
    expect(dependencies.resolveInitialRepositoryIdForLaunch).toHaveBeenCalledOnce();
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321');
  });

  it('ignores a positional path without --add and starts normally', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['/repo'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).not.toHaveBeenCalled();
    expect(addRepository).not.toHaveBeenCalled();
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it.each([['--open'], ['-o']])('does not accept the removed %s option', async (option) => {
    // Given
    const { dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    const parsePromise = program.parseAsync([option], { from: 'user' });

    // Then
    await expect(parsePromise).rejects.toBeInstanceOf(CommanderError);
    await expect(parsePromise).rejects.toMatchObject({
      code: 'commander.unknownOption',
    });
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });
});
