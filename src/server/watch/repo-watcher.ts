import chokidar, { type FSWatcher } from 'chokidar';
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';
import { createRepoIgnoreMatcher } from './repo-ignore-matcher';

const execFileAsync = promisify(execFile);
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

export interface RepoWatcher {
  stop: () => Promise<void>;
}

function runGitCommandSync(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER_BYTES,
  });
}

async function runGitCommand(repoRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER_BYTES,
  });
  return stdout;
}

function buildFingerprint(status: string, head: string): string {
  return createHash('sha1').update(status).update('\0').update(head.trim()).digest('hex');
}

function getHeadRevisionSync(repoRoot: string): string {
  try {
    return runGitCommandSync(repoRoot, ['rev-parse', 'HEAD']);
  } catch {
    return '';
  }
}

async function getHeadRevision(repoRoot: string): Promise<string> {
  try {
    return await runGitCommand(repoRoot, ['rev-parse', 'HEAD']);
  } catch {
    return '';
  }
}

function getGitStateFingerprintSync(repoRoot: string): string {
  const status = runGitCommandSync(repoRoot, [
    'status',
    '--porcelain=v2',
    '--branch',
    '--untracked-files=all',
  ]);
  const head = getHeadRevisionSync(repoRoot);
  return buildFingerprint(status, head);
}

async function getGitStateFingerprint(repoRoot: string): Promise<string> {
  const [status, head] = await Promise.all([
    runGitCommand(repoRoot, ['status', '--porcelain=v2', '--branch', '--untracked-files=all']),
    getHeadRevision(repoRoot),
  ]);
  return buildFingerprint(status, head);
}

function resolveGitPathSync(repoRoot: string, name: string): string {
  const resolvedPath = runGitCommandSync(repoRoot, ['rev-parse', '--git-path', name]).trim();
  return path.isAbsolute(resolvedPath) ? resolvedPath : path.join(repoRoot, resolvedPath);
}

function createWatchPaths(repoRoot: string): string[] {
  return [
    repoRoot,
    resolveGitPathSync(repoRoot, 'index'),
    resolveGitPathSync(repoRoot, 'HEAD'),
    resolveGitPathSync(repoRoot, 'refs'),
    resolveGitPathSync(repoRoot, 'packed-refs'),
  ];
}

function createFileWatcher(repoRoot: string, paths: string[]): FSWatcher {
  return chokidar.watch(paths, {
    ignoreInitial: true,
    ignored: createRepoIgnoreMatcher(repoRoot, paths),
  });
}

export function createRepoWatcher(repoRoot: string, onChanged: () => void): RepoWatcher {
  let lastFingerprint = getGitStateFingerprintSync(repoRoot);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let checking = false;
  let queued = false;
  let stopped = false;

  const runCheck = async (): Promise<void> => {
    if (stopped) {
      return;
    }

    if (checking) {
      queued = true;
      return;
    }

    checking = true;

    try {
      const nextFingerprint = await getGitStateFingerprint(repoRoot);
      if (!stopped && nextFingerprint !== lastFingerprint) {
        lastFingerprint = nextFingerprint;
        onChanged();
      }
    } catch {
      // Git can fail transiently during index updates or repository maintenance.
    } finally {
      checking = false;

      if (queued && !stopped) {
        queued = false;
        scheduleCheck();
      }
    }
  };

  const scheduleCheck = (): void => {
    if (stopped) {
      return;
    }

    if (timer !== null) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      void runCheck();
    }, 200);
  };

  const watchPaths = createWatchPaths(repoRoot);
  const watcher = createFileWatcher(repoRoot, watchPaths);
  watcher.on('all', () => {
    scheduleCheck();
  });

  return {
    stop: async () => {
      stopped = true;
      queued = false;

      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }

      await watcher.close();
    },
  };
}
