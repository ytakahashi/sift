import chokidar from 'chokidar';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { copyFile, mkdir, mkdtemp, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepoWatcher } from '../../watch/repo-watcher';
import { createRepoWatcher } from './repo-watcher-impl';

const execFileAsync = promisify(execFile);

describe.each(['standard', 'linked worktree'])('repository watching (%s)', (layout) => {
  let scratchRoot: string;
  let repoRoot: string;
  let watcher: RepoWatcher | undefined;

  async function git(...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd: repoRoot });
    return stdout.trim();
  }

  async function startWatcher(onChanged: () => void): Promise<void> {
    // Observe the real watcher only to await readiness; filesystem events and
    // Git commands remain real, without racing chokidar's initial scan.
    const watchSpy = vi.spyOn(chokidar, 'watch');
    try {
      watcher = createRepoWatcher(repoRoot, onChanged);
      await once(watchSpy.mock.results[0].value, 'ready');
    } finally {
      watchSpy.mockRestore();
    }
  }

  beforeEach(async () => {
    scratchRoot = await realpath(await mkdtemp(join(tmpdir(), 'sift-repo-watcher-')));
    repoRoot = join(scratchRoot, 'repo');
    watcher = undefined;
    await mkdir(repoRoot);
    const emptyConfig = join(scratchRoot, 'empty-config');
    const emptyTemplate = join(scratchRoot, 'empty-template');
    const emptyHooks = join(scratchRoot, 'empty-hooks');
    await writeFile(emptyConfig, '');
    await mkdir(emptyTemplate);
    await mkdir(emptyHooks);

    // Isolate Git from the developer's configuration, hooks, and environment.
    for (const name of Object.keys(process.env)) {
      if (name.startsWith('GIT_')) {
        vi.stubEnv(name, undefined);
      }
    }
    vi.stubEnv('GIT_CONFIG_GLOBAL', emptyConfig);
    vi.stubEnv('GIT_CONFIG_SYSTEM', emptyConfig);
    vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1');
    vi.stubEnv('GIT_TEMPLATE_DIR', emptyTemplate);
    vi.stubEnv('XDG_CONFIG_HOME', join(scratchRoot, 'empty-xdg'));

    await git('init', '-q');
    await git('config', '--local', 'core.hooksPath', emptyHooks);
    await writeFile(join(repoRoot, 'file.txt'), 'original\n');
    await git('add', 'file.txt');
    await git(
      '-c',
      'user.name=Sift Test',
      '-c',
      'user.email=sift@example.invalid',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '-qm',
      'Initial',
    );
    if (layout === 'linked worktree') {
      const linkedRoot = join(scratchRoot, 'linked');
      await git('worktree', 'add', '-qb', 'feature', linkedRoot);
      repoRoot = linkedRoot;
    }
    await writeFile(join(repoRoot, 'file.txt'), 'modified\n');
  });

  afterEach(async () => {
    try {
      await watcher?.stop();
      await rm(scratchRoot, { recursive: true, force: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('continues reporting external stage and unstage operations', async () => {
    // Given: a modified file and a fully initialized watcher
    const onChanged = vi.fn();
    await startWatcher(onChanged);

    for (let cycle = 0; cycle < 3; cycle++) {
      // When: an external Git process stages the file without editing the worktree
      const beforeStage = onChanged.mock.calls.length;
      await git('add', 'file.txt');

      // Then: the index-only change is reported on every cycle
      await vi.waitFor(() => expect(onChanged.mock.calls.length).toBeGreaterThan(beforeStage), {
        timeout: 5000,
      });

      // When: another external process unstages it
      const beforeReset = onChanged.mock.calls.length;
      await git('reset', '-q', 'HEAD', '--', 'file.txt');

      // Then: watching survives the index replacement
      await vi.waitFor(() => expect(onChanged.mock.calls.length).toBeGreaterThan(beforeReset), {
        timeout: 5000,
      });
    }
  });

  it('continues reporting changes after rapid consecutive index replacements', async () => {
    // Given: an active watcher and two prepared copies of the same valid index
    const onChanged = vi.fn();
    await startWatcher(onChanged);
    const indexPath = await git('rev-parse', '--path-format=absolute', '--git-path', 'index');
    const secondIndex = join(scratchRoot, 'second-index');
    await copyFile(indexPath, `${indexPath}.lock`);
    await copyFile(indexPath, secondIndex);

    // When: the index is replaced twice in quick succession
    await rename(`${indexPath}.lock`, indexPath);
    await delay(1);
    await rename(secondIndex, indexPath);
    // Let chokidar process the replacements before the subsequent Git operation.
    await delay(300);

    // Then: unchanged index content produces no repository change
    expect(onChanged).not.toHaveBeenCalled();

    // When: Git subsequently stages the modified file
    await git('add', 'file.txt');

    // Then: the watcher still detects an index-only change
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1), { timeout: 5000 });
  });

  it('keeps reporting worktree edits when GIT_INDEX_FILE points inside the worktree', async () => {
    // Given: Sift runs with a custom index placed directly under the worktree,
    // which makes the worktree root the index's parent directory
    const indexPath = await git('rev-parse', '--path-format=absolute', '--git-path', 'index');
    const customIndex = join(repoRoot, 'custom-index');
    await copyFile(indexPath, customIndex);
    vi.stubEnv('GIT_INDEX_FILE', customIndex);
    const onChanged = vi.fn();
    await startWatcher(onChanged);

    // When: a tracked worktree file is edited
    await writeFile(join(repoRoot, 'file.txt'), 'edited again\n');

    // Then: the edit is reported instead of being ignored as index metadata
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled(), { timeout: 5000 });

    // When: the file is staged into the custom index
    const beforeStage = onChanged.mock.calls.length;
    await git('add', 'file.txt');

    // Then: the custom index replacement is reported too
    await vi.waitFor(() => expect(onChanged.mock.calls.length).toBeGreaterThan(beforeStage), {
      timeout: 5000,
    });
  });
});
