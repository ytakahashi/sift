import chokidar, { type FSWatcher } from 'chokidar';
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { RepoWatcher } from '../../watch/repo-watcher';
import { createRepoIgnoreMatcher } from './repo-ignore-matcher';

const execFileAsync = promisify(execFile);
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

function runGitCommandSync(repoRoot: string, args: string[]): string {
  // Synchronous Git calls are used only during watcher construction so the
  // initial fingerprint is established before any filesystem events arrive.
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER_BYTES,
  });
}

async function runGitCommand(repoRoot: string, args: string[]): Promise<string> {
  // Runtime checks stay async so chokidar event bursts do not block the server
  // while Git computes the latest repository state.
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER_BYTES,
  });
  return stdout;
}

function buildFingerprint(parts: string[]): string {
  // Separate parts with a NUL byte so adjacent strings cannot accidentally
  // collide when concatenated (for example ["ab", "c"] vs ["a", "bc"]).
  const hash = createHash('sha1');
  for (const part of parts) {
    hash.update(part);
    hash.update('\0');
  }
  return hash.digest('hex');
}

function getHeadRevisionSync(repoRoot: string): string {
  try {
    // Empty repositories do not have HEAD yet. Treat that as an empty revision
    // so auto refresh still works before the first commit.
    return runGitCommandSync(repoRoot, ['rev-parse', 'HEAD']);
  } catch {
    return '';
  }
}

async function getHeadRevision(repoRoot: string): Promise<string> {
  try {
    // Keep the empty-repository behavior consistent with the sync path.
    return await runGitCommand(repoRoot, ['rev-parse', 'HEAD']);
  } catch {
    return '';
  }
}

function getDiffRawSync(repoRoot: string, staged: boolean): string {
  // Raw diff captures whether content moved between working and staged buckets.
  // `git status` alone can stay unchanged during partial stage/unstage flows.
  const args = ['diff', '--raw', '--no-ext-diff', '--color=never'];
  if (staged) {
    args.push('--cached');
  }
  return runGitCommandSync(repoRoot, args);
}

async function getDiffRaw(repoRoot: string, staged: boolean): Promise<string> {
  // Use raw diff for a cheap structural fingerprint; full patch parsing is
  // left to the repository-scoped diff API after a real change has been detected.
  const args = ['diff', '--raw', '--no-ext-diff', '--color=never'];
  if (staged) {
    args.push('--cached');
  }
  return await runGitCommand(repoRoot, args);
}

function getUntrackedMetadataSync(repoRoot: string): string {
  // Git raw diff does not include untracked file content. Track path, size, and
  // mtime so editing an existing untracked file still triggers a refresh.
  const output = runGitCommandSync(repoRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  return output
    .split('\0')
    .filter(Boolean)
    .sort()
    .map((filePath) => {
      try {
        const fileStat = statSync(path.join(repoRoot, filePath));
        return `${filePath}\t${fileStat.size}\t${fileStat.mtimeMs}`;
      } catch {
        return `${filePath}\tmissing`;
      }
    })
    .join('\n');
}

async function getUntrackedMetadata(repoRoot: string): Promise<string> {
  // Mirror the sync untracked metadata path for runtime checks.
  const output = await runGitCommand(repoRoot, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  const entries = await Promise.all(
    output
      .split('\0')
      .filter(Boolean)
      .sort()
      .map(async (filePath) => {
        try {
          const fileStat = await stat(path.join(repoRoot, filePath));
          return `${filePath}\t${fileStat.size}\t${fileStat.mtimeMs}`;
        } catch {
          return `${filePath}\tmissing`;
        }
      }),
  );
  return entries.join('\n');
}

function getGitStateFingerprintSync(repoRoot: string): string {
  // The fingerprint intentionally combines file-level Git status, branch/HEAD,
  // raw working/staged diffs, and untracked metadata. This triggers UI refresh
  // for state movement while letting the client decide whether notes should be
  // cleared based on diff-content hash.
  const status = runGitCommandSync(repoRoot, [
    'status',
    '--porcelain=v2',
    '--branch',
    '--untracked-files=all',
  ]);
  const head = getHeadRevisionSync(repoRoot);
  const workingRaw = getDiffRawSync(repoRoot, false);
  const stagedRaw = getDiffRawSync(repoRoot, true);
  const untrackedMetadata = getUntrackedMetadataSync(repoRoot);
  return buildFingerprint([status, head.trim(), workingRaw, stagedRaw, untrackedMetadata]);
}

async function getGitStateFingerprint(repoRoot: string): Promise<string> {
  // Runtime fingerprint pieces can be computed independently, so run them in
  // parallel to keep auto-refresh latency low after a filesystem event.
  const [status, head, workingRaw, stagedRaw, untrackedMetadata] = await Promise.all([
    runGitCommand(repoRoot, ['status', '--porcelain=v2', '--branch', '--untracked-files=all']),
    getHeadRevision(repoRoot),
    getDiffRaw(repoRoot, false),
    getDiffRaw(repoRoot, true),
    getUntrackedMetadata(repoRoot),
  ]);
  return buildFingerprint([status, head.trim(), workingRaw, stagedRaw, untrackedMetadata]);
}

function resolveGitPathSync(repoRoot: string, name: string): string {
  // `--git-path` handles worktrees and non-standard git directory layouts,
  // where `.git/index` or `.git/refs` may not live directly under repoRoot.
  const resolvedPath = runGitCommandSync(repoRoot, ['rev-parse', '--git-path', name]).trim();
  return path.isAbsolute(resolvedPath) ? resolvedPath : path.join(repoRoot, resolvedPath);
}

function createWatchPaths(repoRoot: string): string[] {
  // Watch both the worktree and specific Git metadata files/directories. The
  // metadata paths catch stage/unstage, branch changes, and packed refs updates.
  return [
    repoRoot,
    resolveGitPathSync(repoRoot, 'index'),
    resolveGitPathSync(repoRoot, 'HEAD'),
    resolveGitPathSync(repoRoot, 'refs'),
    resolveGitPathSync(repoRoot, 'packed-refs'),
  ];
}

function createFileWatcher(repoRoot: string, paths: string[]): FSWatcher {
  // Ignore initial add events because the initial fingerprint is already
  // captured synchronously before chokidar starts watching.
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
      // Chokidar can emit many events while one Git check is in flight. Queue a
      // single follow-up check instead of spawning overlapping Git commands.
      queued = true;
      return;
    }

    checking = true;

    try {
      const nextFingerprint = await getGitStateFingerprint(repoRoot);
      if (!stopped && nextFingerprint !== lastFingerprint) {
        // Update before notifying so a callback-triggered refresh cannot race
        // with the previous fingerprint value.
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
      // Debounce editor write bursts and Git index updates into one check.
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
      // Stop must prevent both future scheduled checks and late notifications
      // from an already-running check.
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
