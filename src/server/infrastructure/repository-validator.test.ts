import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateRepositoryPath } from './repository-validator';

const { execFileMock, realpathMock, statMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  realpathMock: vi.fn(),
  statMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('node:fs/promises', () => ({
  realpath: realpathMock,
  stat: statMock,
}));

function mockDirectory(): void {
  statMock.mockResolvedValue({
    isDirectory: () => true,
  });
}

function mockFile(): void {
  statMock.mockResolvedValue({
    isDirectory: () => false,
  });
}

function mockGitResult(stdout: string): void {
  execFileMock.mockImplementation(
    (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      callback(null, { stderr: '', stdout });
    },
  );
}

function mockGitRoot(inputPath: string, rootPath: string): void {
  execFileMock.mockImplementation(
    (
      _file: string,
      args: string[],
      _options: unknown,
      callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      if (args[1] === '--is-inside-work-tree') {
        callback(null, { stderr: '', stdout: 'true\n' });
        return;
      }

      callback(null, { stderr: '', stdout: `${rootPath}\n` });
    },
  );
  realpathMock.mockImplementation((targetPath: string) => {
    if (targetPath === inputPath) {
      return Promise.resolve(inputPath);
    }
    if (targetPath === rootPath) {
      return Promise.resolve(rootPath);
    }
    return Promise.resolve(targetPath);
  });
}

function mockGitFailure(): void {
  execFileMock.mockImplementation(
    (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
      callback(new Error('not a git repo'), { stderr: 'fatal', stdout: '' });
    },
  );
}

describe('validateRepositoryPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realpathMock.mockImplementation((targetPath: string) => Promise.resolve(targetPath));
  });

  it('returns valid for an existing Git repository root', async () => {
    // Given
    mockDirectory();
    mockGitRoot('/repo/sift', '/repo/sift');

    // When
    const result = await validateRepositoryPath({ id: 'sift', path: '/repo/sift' });

    // Then
    expect(result).toEqual({ isValid: true });
    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--is-inside-work-tree'],
      {
        cwd: '/repo/sift',
        encoding: 'utf8',
      },
      expect.any(Function),
    );
    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--show-toplevel'],
      {
        cwd: '/repo/sift',
        encoding: 'utf8',
      },
      expect.any(Function),
    );
  });

  it('returns invalid when the path does not exist', async () => {
    // Given
    statMock.mockRejectedValue(new Error('missing'));

    // When
    const result = await validateRepositoryPath({ id: 'missing', path: '/repo/missing' });

    // Then
    expect(result).toEqual({
      error: 'Repository path does not exist.',
      isValid: false,
    });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('returns invalid when the path is not a directory', async () => {
    // Given
    mockFile();

    // When
    const result = await validateRepositoryPath({ id: 'file', path: '/repo/file.txt' });

    // Then
    expect(result).toEqual({
      error: 'Repository path is not a directory.',
      isValid: false,
    });
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('returns invalid when Git rejects the path', async () => {
    // Given
    mockDirectory();
    mockGitFailure();

    // When
    const result = await validateRepositoryPath({ id: 'not-git', path: '/repo/not-git' });

    // Then
    expect(result).toEqual({
      error: 'Repository path is not a Git repository.',
      isValid: false,
    });
  });

  it('returns invalid when Git reports false', async () => {
    // Given
    mockDirectory();
    mockGitResult('false\n');

    // When
    const result = await validateRepositoryPath({ id: 'not-worktree', path: '/repo/not-worktree' });

    // Then
    expect(result).toEqual({
      error: 'Repository path is not a Git repository.',
      isValid: false,
    });
  });

  it('returns invalid when the repository path is not the repository root', async () => {
    // Given
    mockDirectory();
    mockGitRoot('/repo/sift/src', '/repo/sift');

    // When
    const result = await validateRepositoryPath({ id: 'sift', path: '/repo/sift/src' });

    // Then
    expect(result).toEqual({
      error: 'Repository path must be the Git repository root.',
      isValid: false,
    });
  });

  it('accepts a symlinked repository root when canonical paths match', async () => {
    // Given
    mockDirectory();
    mockGitRoot('/link/sift', '/repo/sift');
    realpathMock.mockImplementation((targetPath: string) => {
      if (targetPath === '/link/sift' || targetPath === '/repo/sift') {
        return Promise.resolve('/private/repo/sift');
      }
      return Promise.resolve(targetPath);
    });

    // When
    const result = await validateRepositoryPath({ id: 'sift', path: '/link/sift' });

    // Then
    expect(result).toEqual({ isValid: true });
  });

  it('returns invalid when the repository id contains invalid characters', async () => {
    // Given
    mockDirectory();
    mockGitResult('true\n');

    // When
    const result = await validateRepositoryPath({ id: 'invalid id space', path: '/repo/sift' });

    // Then
    expect(result).toEqual({
      error: 'Repository id must contain only lowercase letters, numbers, and hyphens.',
      isValid: false,
    });
  });

  it('returns invalid when the repository path is not absolute', async () => {
    // Given
    mockDirectory();
    mockGitResult('true\n');

    // When
    const result = await validateRepositoryPath({ id: 'sift', path: './relative-path/sift' });

    // Then
    expect(result).toEqual({
      error: 'Repository path must be an absolute path.',
      isValid: false,
    });
  });
});
