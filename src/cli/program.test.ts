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

type WriteOutput = ReturnType<typeof vi.fn<(text: string) => void>>;

interface TestOutput {
  writeErr: WriteOutput;
  writeOut: WriteOutput;
}

function createTestOutput(): TestOutput {
  return {
    writeErr: vi.fn<(text: string) => void>(),
    writeOut: vi.fn<(text: string) => void>(),
  };
}

function getOutputText(writeOutput: WriteOutput): string {
  return writeOutput.mock.calls.map(([text]) => String(text)).join('');
}

function createTestProgram(dependencies: CliDependencies, output = createTestOutput()): Command {
  const program = createCliProgram(dependencies);
  program.exitOverride();
  program.configureOutput({
    writeErr: output.writeErr,
    writeOut: output.writeOut,
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

  it('prints help without side effects when no option is provided', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    const output = createTestOutput();
    const program = createTestProgram(dependencies, output);

    // When
    await program.parseAsync([], { from: 'user' });

    // Then
    const helpText = getOutputText(output.writeOut);
    expect(helpText).toContain('Usage:');
    expect(helpText).toContain('--add [path]');
    expect(helpText).toContain('-s, --server');
    expect(helpText).toContain('-b, --browser');
    expect(helpText).toContain('-a, --app');
    expect(helpText).toContain('-h, --help');
    expect(dependencies.resolveRepoRoot).not.toHaveBeenCalled();
    expect(addRepository).not.toHaveBeenCalled();
    expect(dependencies.resolveInitialRepositoryIdForLaunch).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it.each([['--help'], ['-h']])('prints help for %s without side effects', async (option) => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    const output = createTestOutput();
    const program = createTestProgram(dependencies, output);

    // When
    const parsePromise = program.parseAsync([option], { from: 'user' });

    // Then
    await expect(parsePromise).rejects.toMatchObject({
      code: 'commander.helpDisplayed',
    });
    const helpText = getOutputText(output.writeOut);
    expect(helpText).toContain('Usage:');
    expect(helpText).toContain('-s, --server');
    expect(helpText).toContain('-b, --browser');
    expect(helpText).toContain('-a, --app');
    expect(dependencies.resolveRepoRoot).not.toHaveBeenCalled();
    expect(addRepository).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it.each([['--server'], ['-s']])(
    'starts the server and prints the browser URL when %s is provided',
    async (option) => {
      // Given
      const { dependencies } = createDependencies();
      const program = createTestProgram(dependencies);

      // When
      await program.parseAsync([option], { from: 'user' });

      // Then
      expect(dependencies.resolveInitialRepositoryIdForLaunch).not.toHaveBeenCalled();
      expect(dependencies.startServer).toHaveBeenCalledOnce();
      expect(console.log).toHaveBeenCalledWith('Server started at http://127.0.0.1:49321');
      expect(console.log).toHaveBeenCalledWith(
        'Open http://127.0.0.1:49321 in your browser to view the diff.',
      );
      expect(dependencies.openBrowser).not.toHaveBeenCalled();
    },
  );

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

  it.each([['--app'], ['-a']])(
    'opens the macOS app with the resolved repository ID when %s is provided',
    async (option) => {
      // Given
      const { dependencies } = createDependencies();
      const program = createTestProgram(dependencies);

      // When
      await program.parseAsync([option], { from: 'user' });

      // Then
      expect(dependencies.resolveInitialRepositoryIdForLaunch).toHaveBeenCalledOnce();
      expect(dependencies.openApp).toHaveBeenCalledWith('repo-123');
      expect(dependencies.startServer).not.toHaveBeenCalled();
      expect(dependencies.openBrowser).not.toHaveBeenCalled();
      expect(
        vi.mocked(dependencies.resolveInitialRepositoryIdForLaunch).mock.invocationCallOrder[0],
      ).toBeLessThan(vi.mocked(dependencies.openApp).mock.invocationCallOrder[0]);
    },
  );

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
    expect(dependencies.startServer).not.toHaveBeenCalled();
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
    expect(dependencies.startServer).not.toHaveBeenCalled();
  });

  it('adds the repository and starts the server when --add and --server are provided', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    vi.mocked(dependencies.resolveRepoRoot).mockReturnValue('/resolved/repo');
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['--add', '/path', '--server'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).toHaveBeenCalledWith('/path');
    expect(addRepository).toHaveBeenCalledWith('/resolved/repo');
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith('Server started at http://127.0.0.1:49321');
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

  it('rejects --app together with --server before side effects', async () => {
    // Given
    const { dependencies } = createDependencies();
    const program = createTestProgram(dependencies);

    // When & Then
    await expect(program.parseAsync(['--app', '--server'], { from: 'user' })).rejects.toThrow(
      'Cannot specify both --app and --server.',
    );
    expect(dependencies.resolveInitialRepositoryIdForLaunch).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('opens the just-added repository in the browser when --add and --browser are provided', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    vi.mocked(dependencies.resolveRepoRoot).mockReturnValue('/resolved/repo');
    vi.mocked(addRepository).mockResolvedValue({
      id: 'added-repo',
      name: 'added',
      path: '/resolved/repo',
    });
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['--add', '/path', '--browser'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).toHaveBeenCalledWith('/path');
    expect(addRepository).toHaveBeenCalledWith('/resolved/repo');
    // The added repo is used directly, so cwd-based git detection is skipped.
    expect(dependencies.resolveInitialRepositoryIdForLaunch).not.toHaveBeenCalled();
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith(
      'http://127.0.0.1:49321/repos/added-repo',
    );
  });

  it('opens the just-added repository in the macOS app when --add and --app are provided', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    vi.mocked(dependencies.resolveRepoRoot).mockReturnValue('/resolved/repo');
    vi.mocked(addRepository).mockResolvedValue({
      id: 'added-repo',
      name: 'added',
      path: '/resolved/repo',
    });
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['--add', '/path', '--app'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).toHaveBeenCalledWith('/path');
    expect(addRepository).toHaveBeenCalledWith('/resolved/repo');
    expect(dependencies.resolveInitialRepositoryIdForLaunch).not.toHaveBeenCalled();
    expect(dependencies.openApp).toHaveBeenCalledWith('added-repo');
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

  it('ignores a positional path without --add and prints help', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    const output = createTestOutput();
    const program = createTestProgram(dependencies, output);

    // When
    await program.parseAsync(['/repo'], { from: 'user' });

    // Then
    expect(getOutputText(output.writeOut)).toContain('Usage:');
    expect(dependencies.resolveRepoRoot).not.toHaveBeenCalled();
    expect(addRepository).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
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
