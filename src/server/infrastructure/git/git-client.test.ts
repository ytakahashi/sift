import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
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
