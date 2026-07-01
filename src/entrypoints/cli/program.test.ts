import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommanderError, type Command } from 'commander';
import type { CliDependencies } from './program';
import { createCliProgram } from './program';

function createDependencies(): CliDependencies {
  const addRepository = vi.fn().mockResolvedValue({
    id: 'sift-repo',
    name: 'sift',
    path: '/repo/sift',
  });

  return {
    createRepositoryConfigUpdater: vi.fn(() => ({ addRepository })),
    openApp: vi.fn().mockResolvedValue(undefined),
    openBrowser: vi.fn(),
    resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
    resolveRepositoryIdForOpen: vi.fn().mockResolvedValue('repo-123'),
    startServer: vi.fn().mockResolvedValue('http://127.0.0.1:49321'),
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
  // Subcommands inherit exitOverride/configureOutput so their own parseAsync
  // rejections/output are observable the same way as the root's.
  for (const subcommand of program.commands) {
    subcommand.exitOverride();
    subcommand.configureOutput({
      writeErr: output.writeErr,
      writeOut: output.writeOut,
    });
  }
  return program;
}

describe('createCliProgram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('prints help without side effects when no command is provided', async () => {
    // Given
    const dependencies = createDependencies();
    const output = createTestOutput();
    const program = createTestProgram(dependencies, output);

    // When
    await program.parseAsync([], { from: 'user' });

    // Then
    const helpText = getOutputText(output.writeOut);
    expect(helpText).toContain('Usage:');
    expect(helpText).toContain('open');
    expect(helpText).toContain('add');
    expect(helpText).toContain('serve');
    expect(helpText).toContain('-h, --help');
    expect(dependencies.resolveRepoRoot).not.toHaveBeenCalled();
    expect(dependencies.resolveRepositoryIdForOpen).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it.each([['--help'], ['-h']])('prints help for %s without side effects', async (option) => {
    // Given
    const dependencies = createDependencies();
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
    expect(helpText).toContain('open');
    expect(helpText).toContain('add');
    expect(helpText).toContain('serve');
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized top-level argument instead of silently opening help', async () => {
    // Given
    const dependencies = createDependencies();
    const output = createTestOutput();
    const program = createTestProgram(dependencies, output);

    // When
    const parsePromise = program.parseAsync(['/repo'], { from: 'user' });

    // Then
    await expect(parsePromise).rejects.toBeInstanceOf(CommanderError);
    await expect(parsePromise).rejects.toMatchObject({
      code: 'commander.excessArguments',
    });
    expect(dependencies.resolveRepoRoot).not.toHaveBeenCalled();
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('routes to the open command and opens the browser', async () => {
    // Given
    const dependencies = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['open'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepositoryIdForOpen).toHaveBeenCalledWith(undefined);
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.openBrowser).toHaveBeenCalledWith('http://127.0.0.1:49321/repos/repo-123');
  });

  it('routes to the open command with --app', async () => {
    // Given
    const dependencies = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['open', '--app'], { from: 'user' });

    // Then
    expect(dependencies.openApp).toHaveBeenCalledWith('repo-123');
    expect(dependencies.startServer).not.toHaveBeenCalled();
  });

  it('routes to the add command', async () => {
    // Given
    const dependencies = createDependencies();
    vi.mocked(dependencies.resolveRepoRoot).mockReturnValue('/resolved/repo');
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['add', '/path'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).toHaveBeenCalledWith('/path');
    expect(dependencies.startServer).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
  });

  it('routes to the serve command', async () => {
    // Given
    const dependencies = createDependencies();
    const program = createTestProgram(dependencies);

    // When
    await program.parseAsync(['serve'], { from: 'user' });

    // Then
    expect(dependencies.startServer).toHaveBeenCalledOnce();
    expect(dependencies.resolveRepositoryIdForOpen).not.toHaveBeenCalled();
    expect(dependencies.openBrowser).not.toHaveBeenCalled();
    expect(dependencies.openApp).not.toHaveBeenCalled();
  });

  it.each([['--open'], ['-o']])('does not accept the removed %s option', async (option) => {
    // Given
    const dependencies = createDependencies();
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
