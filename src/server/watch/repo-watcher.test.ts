import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepoWatcher } from './repo-watcher';

type WatchHandler = () => void;

const { closeMock, execFileMock, execFileSyncMock, watchMock } = vi.hoisted(() => ({
  closeMock: vi.fn().mockResolvedValue(undefined),
  execFileMock: vi.fn(),
  execFileSyncMock: vi.fn(),
  watchMock: vi.fn(),
}));

vi.mock('chokidar', () => ({
  default: {
    watch: watchMock,
  },
}));

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
  execFileSync: execFileSyncMock,
}));

function createExecFileMock() {
  return (
    _file: string,
    args: string[],
    _options: unknown,
    callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
  ): void => {
    const command = args.join(' ');

    if (command === 'status --porcelain=v2 --branch --untracked-files=all') {
      callback(null, { stdout: asyncStatusOutput, stderr: '' });
      return;
    }

    if (command === 'rev-parse HEAD') {
      callback(null, { stdout: asyncHeadOutput, stderr: '' });
      return;
    }

    callback(new Error(`Unexpected command: ${command}`), { stdout: '', stderr: '' });
  };
}

let allHandler: WatchHandler | null = null;
let asyncStatusOutput = '';
let asyncHeadOutput = '';

describe('createRepoWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    allHandler = null;
    asyncStatusOutput = 'status-initial\n';
    asyncHeadOutput = 'HEAD-initial\n';

    execFileSyncMock.mockImplementation((_file: string, args: string[]) => {
      const command = args.join(' ');

      if (command === 'status --porcelain=v2 --branch --untracked-files=all') {
        return 'status-initial\n';
      }

      if (command === 'rev-parse HEAD') {
        return 'HEAD-initial\n';
      }

      if (command === 'rev-parse --git-path index') {
        return '.git/index\n';
      }

      if (command === 'rev-parse --git-path HEAD') {
        return '.git/HEAD\n';
      }

      if (command === 'rev-parse --git-path refs') {
        return '.git/refs\n';
      }

      if (command === 'rev-parse --git-path packed-refs') {
        return '.git/packed-refs\n';
      }

      throw new Error(`Unexpected sync command: ${command}`);
    });

    execFileMock.mockImplementation(createExecFileMock());

    watchMock.mockImplementation((_paths: string[], _options: unknown) => ({
      on: vi.fn((event: string, handler: WatchHandler) => {
        if (event === 'all') {
          allHandler = handler;
        }
      }),
      close: closeMock,
    }));
  });

  it('broadcasts only when the git fingerprint changes', async () => {
    // Given: a watcher bound to one repository
    const onChanged = vi.fn();
    createRepoWatcher('/repo/root', onChanged);

    // When: one fs event keeps the same git fingerprint
    allHandler?.();
    await vi.advanceTimersByTimeAsync(200);

    // Then: no change is reported
    expect(onChanged).not.toHaveBeenCalled();

    // Given: the next git status differs from the initial fingerprint
    asyncStatusOutput = 'status-updated\n';

    // When: another fs event arrives
    allHandler?.();
    await vi.advanceTimersByTimeAsync(200);

    // Then: the watcher reports a single repository change
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('debounces burst events into a single git check', async () => {
    // Given: a watcher with a registered fs handler
    const onChanged = vi.fn();
    createRepoWatcher('/repo/root', onChanged);

    // When: multiple fs events arrive within the debounce window
    allHandler?.();
    allHandler?.();
    allHandler?.();
    await vi.advanceTimersByTimeAsync(200);

    // Then: status/head are each queried once for the burst
    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('stops the underlying chokidar watcher', async () => {
    // Given: an active repo watcher
    const watcher = createRepoWatcher('/repo/root', vi.fn());

    // When: it is stopped
    await watcher.stop();

    // Then: chokidar is closed
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
