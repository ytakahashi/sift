import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { execFile, spawn } from 'node:child_process';
import { GitClient } from './git-client';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
}));

/**
 * Minimal stand-in for the ChildProcess surface hashObjects touches:
 * stdout/stderr event streams, process-level events, and a stdin sink that
 * records what was written.
 */
class FakeChildProcess extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  readonly stdin = {
    written: '',
    ended: false,
    write(chunk: string): boolean {
      this.written += chunk;
      return true;
    },
    end(): void {
      this.ended = true;
    },
  };
}

function stubSpawnedChild(): FakeChildProcess {
  const child = new FakeChildProcess();
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
  return child;
}

describe('GitClient.hashObjects', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('feeds paths via stdin and resolves blob ids in input order', async () => {
    // Given: a spawned process that will succeed
    const child = stubSpawnedChild();
    const client = new GitClient('/repo/root');

    // When: two paths are hashed; stdout arrives split across chunks
    const promise = client.hashObjects(['a.ts', 'b/c.ts']);
    child.stdout.emit('data', Buffer.from('blob-a\nblo'));
    child.stdout.emit('data', Buffer.from('b-c\n'));
    child.emit('close', 0);

    // Then: ids come back aligned with the input order
    await expect(promise).resolves.toEqual(['blob-a', 'blob-c']);

    // Then: the batch runs in the repository root with paths on stdin
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith('git', ['hash-object', '--stdin-paths'], {
      cwd: '/repo/root',
    });
    expect(child.stdin.written).toBe('a.ts\nb/c.ts\n');
    expect(child.stdin.ended).toBe(true);
  });

  it('rejects with stderr output on a non-zero exit code', async () => {
    // Given: a process that fails after emitting diagnostics
    const child = stubSpawnedChild();
    const client = new GitClient('/repo/root');

    // When: the process exits with a failure code
    const promise = client.hashObjects(['a.ts']);
    child.stderr.emit('data', Buffer.from('fatal: not a git repository\n'));
    child.emit('close', 128);

    // Then: the rejection carries the stderr diagnostics
    await expect(promise).rejects.toThrow('fatal: not a git repository');
  });

  it('rejects when the process fails to start', async () => {
    // Given: spawning emits an error (e.g. git binary missing)
    const child = stubSpawnedChild();
    const client = new GitClient('/repo/root');

    // When: the error event fires instead of close
    const promise = client.hashObjects(['a.ts']);
    child.emit('error', new Error('spawn git ENOENT'));

    // Then: the rejection surfaces the launch failure
    await expect(promise).rejects.toThrow('spawn git ENOENT');
  });

  it('rejects when the output count does not match the input count', async () => {
    // Given: a "successful" exit whose output cannot be attributed to paths.
    // Callers rely on this rejection to mark the whole batch unavailable
    // instead of adopting partial output.
    const child = stubSpawnedChild();
    const client = new GitClient('/repo/root');

    // When: only one id is produced for two paths
    const promise = client.hashObjects(['a.ts', 'b.ts']);
    child.stdout.emit('data', Buffer.from('blob-a\n'));
    child.emit('close', 0);

    // Then: the mismatch is treated as a failure
    await expect(promise).rejects.toThrow('returned 1 ids for 2 paths');
  });

  it('resolves an empty batch without spawning a process', async () => {
    // Given: no paths to hash
    const client = new GitClient('/repo/root');

    // When: the batch is empty
    const result = await client.hashObjects([]);

    // Then: no subprocess is started
    expect(result).toEqual([]);
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe('GitClient index content commands', () => {
  it('requests a literal pathspec and selects only its stage-zero entry', async () => {
    // Given: the path contains characters Git would otherwise treat as pathspec syntax
    const client = new GitClient('/repo/root');
    const runGitCommand = vi
      .spyOn(client, 'runGitCommand')
      .mockResolvedValue(
        ['100644 aaaa1111 1\tsrc/[literal].ts', '100755 deadbeef 0\tsrc/[literal].ts', ''].join(
          '\0',
        ),
      );

    // When
    const entry = await client.getIndexEntry('src/[literal].ts');

    // Then
    expect(entry).toEqual({ mode: '100755', blobId: 'deadbeef' });
    expect(runGitCommand).toHaveBeenCalledWith([
      '--literal-pathspecs',
      'ls-files',
      '--stage',
      '-z',
      '--',
      'src/[literal].ts',
    ]);
  });

  it('returns null when the index has no exact stage-zero entry', async () => {
    // Given: only conflict stages and a different path are returned
    const client = new GitClient('/repo/root');
    vi.spyOn(client, 'runGitCommand').mockResolvedValue(
      ['100644 aaaa1111 2\tsrc/file.ts', '100644 bbbb2222 0\tsrc/file.ts.bak', ''].join('\0'),
    );

    // When / Then
    await expect(client.getIndexEntry('src/file.ts')).resolves.toBeNull();
  });

  it('requests full object ids in diff output', async () => {
    // Given
    const client = new GitClient('/repo/root');
    const runGitCommand = vi.spyOn(client, 'runGitCommand').mockResolvedValue('');

    // When
    await client.getDiffOutput(true);

    // Then
    expect(runGitCommand).toHaveBeenCalledWith([
      'diff',
      '--no-ext-diff',
      '--color=never',
      '--full-index',
      '--cached',
    ]);
  });

  it('parses a non-negative blob size and rejects invalid output', async () => {
    // Given
    const client = new GitClient('/repo/root');
    const runGitCommand = vi.spyOn(client, 'runGitCommand');
    runGitCommand.mockResolvedValueOnce('512\n').mockResolvedValueOnce('not-a-size\n');

    // When / Then
    await expect(client.getBlobSize('blob')).resolves.toBe(512);
    await expect(client.getBlobSize('blob')).rejects.toThrow('invalid blob size');
  });
});

describe('GitClient.getBlobContent', () => {
  type ExecFileCallback = (error: Error | null, result: { stdout: Buffer; stderr: Buffer }) => void;

  beforeEach(() => {
    vi.mocked(execFile).mockReset();
  });

  it('requests buffer-encoded output so binary bytes survive intact', async () => {
    // Given: a blob whose bytes are not valid UTF-8 on their own (a lone
    // continuation byte), which would be corrupted by text-mode decoding
    const stdout = Buffer.from([0xff, 0x00, 0x41]);
    vi.mocked(execFile).mockImplementation(((
      _file: string,
      _args: string[],
      options: unknown,
      callback: ExecFileCallback,
    ) => {
      expect(options).toMatchObject({ cwd: '/repo/root', encoding: 'buffer' });
      callback(null, { stdout, stderr: Buffer.alloc(0) });
    }) as unknown as typeof execFile);
    const client = new GitClient('/repo/root');

    // When
    const result = await client.getBlobContent('blob-id');

    // Then
    expect(result).toEqual(stdout);
    expect(execFile).toHaveBeenCalledWith(
      'git',
      ['cat-file', '-p', 'blob-id'],
      expect.objectContaining({ encoding: 'buffer' }),
      expect.any(Function),
    );
  });

  it('wraps a failed cat-file call in a "Git command failed" error', async () => {
    // Given
    vi.mocked(execFile).mockImplementation(((
      _file: string,
      _args: string[],
      _options: unknown,
      callback: ExecFileCallback,
    ) => {
      callback(new Error('fatal: not a valid object name blob-id'), {
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
      });
    }) as unknown as typeof execFile);
    const client = new GitClient('/repo/root');

    // When / Then
    await expect(client.getBlobContent('blob-id')).rejects.toThrow(
      'Git command failed: git cat-file -p blob-id',
    );
  });
});
