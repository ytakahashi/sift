import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepoWatcher } from './repo-watcher-impl';

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

    if (command === 'diff --raw --no-ext-diff --color=never') {
      callback(null, { stdout: asyncWorkingRawOutput, stderr: '' });
      return;
    }

    if (command === 'diff --raw --no-ext-diff --color=never --cached') {
      callback(null, { stdout: asyncStagedRawOutput, stderr: '' });
      return;
    }

    if (command === 'ls-files --others --exclude-standard -z') {
      callback(null, { stdout: asyncUntrackedOutput, stderr: '' });
      return;
    }

    callback(new Error(`Unexpected command: ${command}`), { stdout: '', stderr: '' });
  };
}

let allHandler: WatchHandler | null = null;
let asyncStatusOutput = '';
let asyncHeadOutput = '';
let asyncWorkingRawOutput = '';
let asyncStagedRawOutput = '';
let asyncUntrackedOutput = '';
let statusGate: Promise<void> | null = null;
let releaseStatusGate: (() => void) | null = null;

describe('createRepoWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    allHandler = null;
    asyncStatusOutput = 'status-initial\n';
    asyncHeadOutput = 'HEAD-initial\n';
    asyncWorkingRawOutput = 'working-raw-initial\n';
    asyncStagedRawOutput = 'staged-raw-initial\n';
    asyncUntrackedOutput = '';
    statusGate = null;
    releaseStatusGate = null;

    execFileSyncMock.mockImplementation((_file: string, args: string[]) => {
      const command = args.join(' ');

      if (command === 'status --porcelain=v2 --branch --untracked-files=all') {
        return 'status-initial\n';
      }

      if (command === 'rev-parse HEAD') {
        return 'HEAD-initial\n';
      }

      if (command === 'diff --raw --no-ext-diff --color=never') {
        return 'working-raw-initial\n';
      }

      if (command === 'diff --raw --no-ext-diff --color=never --cached') {
        return 'staged-raw-initial\n';
      }

      if (command === 'ls-files --others --exclude-standard -z') {
        return '';
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

      if (command === 'rev-parse --git-path .') {
        return '.git\n';
      }

      throw new Error(`Unexpected sync command: ${command}`);
    });

    execFileMock.mockImplementation(
      (
        file: string,
        args: string[],
        options: unknown,
        callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
      ) => {
        const command = args.join(' ');

        if (
          command === 'status --porcelain=v2 --branch --untracked-files=all' &&
          statusGate !== null
        ) {
          void statusGate.then(() => {
            createExecFileMock()(file, args, options, callback);
          });
          return;
        }

        createExecFileMock()(file, args, options, callback);
      },
    );

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

    // Then: the fingerprint commands are queried once for the burst
    // (5 async Git calls per check: status, rev-parse HEAD,
    //  working diff --raw, staged diff --raw, ls-files --others)
    expect(execFileMock).toHaveBeenCalledTimes(5);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('detects staged and working diff movement when status output is unchanged', async () => {
    // Given: a watcher whose file-level status does not change
    const onChanged = vi.fn();
    createRepoWatcher('/repo/root', onChanged);

    // When: raw diff content moves between working and staged buckets
    asyncWorkingRawOutput = 'working-raw-updated\n';
    asyncStagedRawOutput = 'staged-raw-updated\n';
    allHandler?.();
    await vi.advanceTimersByTimeAsync(200);

    // Then: a repository change is reported even though status stayed the same
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('stops the underlying chokidar watcher', async () => {
    // Given: an active repo watcher
    const watcher = createRepoWatcher('/repo/root', vi.fn());

    // When: it is stopped
    await watcher.stop();

    // Then: chokidar is closed
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('does not notify after stop when an in-flight fingerprint changes', async () => {
    // Given: the next status check is delayed until after stop is called
    let release!: () => void;
    statusGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    releaseStatusGate = release;
    asyncStatusOutput = 'status-updated\n';

    const onChanged = vi.fn();
    const watcher = createRepoWatcher('/repo/root', onChanged);

    // When: a check starts, then the watcher is stopped before git returns
    allHandler?.();
    await vi.advanceTimersByTimeAsync(200);
    const stopPromise = watcher.stop();
    releaseStatusGate?.();
    await stopPromise;
    await Promise.resolve();

    // Then: no late notification is emitted after stop
    expect(onChanged).not.toHaveBeenCalled();
  });
});
