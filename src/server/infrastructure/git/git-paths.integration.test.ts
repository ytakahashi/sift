import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitClient } from './git-client';
import { applyPatch } from './git-patch-applier';
import { parseDiff } from '../../../domain/diff/diff-parser';
import { createPatchForHunk } from '../../../domain/git/git-patch';

const execFileAsync = promisify(execFile);
const paths = [
  '日本語.txt',
  'a b/c b/d.txt',
  'tab\tname.txt',
  'line\nbreak.txt',
  '"quoted".txt',
  'back\\slash.txt',
  'trailing space ',
];

describe('Git path round trips', () => {
  let scratchRoot: string;
  let repoRoot: string;
  let client: GitClient;

  async function git(...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd: repoRoot });
    return stdout;
  }

  beforeEach(async () => {
    // Given: an isolated repository independent of the user's Git environment
    scratchRoot = await mkdtemp(join(tmpdir(), 'sift-literal-pathspec-'));
    repoRoot = join(scratchRoot, 'repo');
    const emptyConfig = join(scratchRoot, 'empty-config');
    const emptyTemplate = join(scratchRoot, 'empty-template');
    const emptyHooks = join(scratchRoot, 'empty-hooks');
    await mkdir(repoRoot);
    await writeFile(emptyConfig, '');
    await mkdir(emptyTemplate);
    await mkdir(emptyHooks);

    // GitClient inherits process.env, so isolate every Git subprocess in this test.
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
    await writeFile(join(repoRoot, 'initial'), 'initial\n');
    await git('add', '-A');
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
    client = new GitClient(repoRoot);
  });

  afterEach(async () => {
    try {
      await rm(scratchRoot, { recursive: true, force: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each(['diff.noprefix', 'diff.mnemonicPrefix'])(
    'stages and unstages special paths with %s enabled',
    async (setting) => {
      // Given
      await git('config', setting, 'true');
      await git('config', 'core.quotePath', 'true');
      for (const path of paths) {
        await mkdir(dirname(join(repoRoot, path)), { recursive: true });
        await writeFile(join(repoRoot, path), 'old\n');
      }
      await git('add', '-A');
      await git(
        '-c',
        'user.name=Sift Test',
        '-c',
        'user.email=sift@example.invalid',
        '-c',
        'commit.gpgSign=false',
        'commit',
        '-qm',
        'Paths',
      );

      // When: parse, reconstruct, and apply each working-tree hunk
      for (const path of paths) await writeFile(join(repoRoot, path), 'new\n');
      const files = parseDiff(await client.getDiffOutput(false), 'working');
      expect(files.map((file) => file.path).sort()).toEqual([...paths].sort());
      for (const file of files)
        await applyPatch(client, createPatchForHunk(file, file.hunks[0]), false);

      // Then: all staged paths and contents survive, and reverse application restores the index
      expect(await client.getDiffOutput(false)).toBe('');
      const staged = parseDiff(await client.getDiffOutput(true), 'staged');
      expect(staged.map((file) => file.path).sort()).toEqual([...paths].sort());
      for (const file of staged) {
        expect(await git('show', `:${file.path}`)).toBe('new\n');
        await applyPatch(client, createPatchForHunk(file, file.hunks[0]), true);
        expect(await readFile(join(repoRoot, file.path), 'utf8')).toBe('new\n');
      }
      expect(await client.getDiffOutput(true)).toBe('');
    },
  );

  it('preserves binary and renamed paths without text headers', async () => {
    // Given
    const oldPath = 'old b/日本語.txt';
    const newPath = 'new b/tab\tname.txt';
    const binaryPath = 'binary b/data.bin';
    for (const path of [oldPath, binaryPath]) {
      await mkdir(dirname(join(repoRoot, path)), { recursive: true });
      await writeFile(join(repoRoot, path), Buffer.from([0, 1, 2]));
    }
    await git('add', '-A');
    await git(
      '-c',
      'user.name=Sift Test',
      '-c',
      'user.email=sift@example.invalid',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '-qm',
      'Binary paths',
    );
    await mkdir(dirname(join(repoRoot, newPath)), { recursive: true });
    await git('mv', '--', oldPath, newPath);
    await writeFile(join(repoRoot, binaryPath), Buffer.from([0, 3, 4]));
    await git('add', '-A');

    // When
    const files = parseDiff(await client.getDiffOutput(true), 'staged');

    // Then
    expect(files).toHaveLength(2);
    expect(files.find((file) => file.path === newPath)).toMatchObject({
      oldPath,
      status: 'renamed',
      displayPath: newPath,
      hunks: [],
    });
    expect(files.find((file) => file.path === binaryPath)).toMatchObject({
      kind: 'binary',
      displayPath: binaryPath,
      hunks: [],
    });
  });

  it('reports a copied file as added even with diff.renames=copies', async () => {
    // Given: modifying the source makes Git consider it for copy detection
    await git('config', 'diff.renames', 'copies');
    const content = Array.from({ length: 20 }, (_, index) => `line ${index}\n`).join('');
    await writeFile(join(repoRoot, 'source.txt'), content);
    await git('add', '-A');
    await git(
      '-c',
      'user.name=Sift Test',
      '-c',
      'user.email=sift@example.invalid',
      '-c',
      'commit.gpgSign=false',
      'commit',
      '-qm',
      'Source',
    );
    await writeFile(join(repoRoot, 'copy.txt'), content);
    await writeFile(join(repoRoot, 'source.txt'), `${content}appended\n`);
    await git('add', '-A');

    // When
    const files = parseDiff(await client.getDiffOutput(true), 'staged');

    // Then: the copy is a plain addition, so its hunk patch cannot drop source.txt from the index
    expect(files.find((file) => file.path === 'copy.txt')).toMatchObject({ status: 'added' });
    expect(files.find((file) => file.path === 'copy.txt')?.oldPath).toBeUndefined();
  });

  it('returns exact untracked paths without decoding or splitting their contents', async () => {
    // Given
    for (const path of paths) {
      await mkdir(dirname(join(repoRoot, path)), { recursive: true });
      await writeFile(join(repoRoot, path), 'content\n');
    }

    // When / Then
    expect((await client.getUntrackedFiles()).sort()).toEqual([...paths].sort());
  });
});
