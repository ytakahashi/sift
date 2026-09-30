import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceActionServiceImpl } from './workspace-action-service-impl';

const execFileAsync = promisify(execFile);
const literalPath = 'app/[id]/page.tsx';
const matchingPath = 'app/i/page.tsx';

describe('workspace actions with Git pathspec characters', () => {
  let scratchRoot: string;
  let repoRoot: string;
  let service: WorkspaceActionServiceImpl;

  async function git(...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd: repoRoot });
    return stdout;
  }

  async function stagedPaths(): Promise<string[]> {
    return (await git('diff', '--cached', '--name-only', '-z')).split('\0').filter(Boolean);
  }

  beforeEach(async () => {
    // Given: a literal bracketed path and a path that its Git glob matches
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
    await mkdir(join(repoRoot, 'app/[id]'), { recursive: true });
    await mkdir(join(repoRoot, 'app/i'), { recursive: true });
    await writeFile(join(repoRoot, literalPath), 'original literal\n');
    await writeFile(join(repoRoot, matchingPath), 'original matching\n');
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
    service = new WorkspaceActionServiceImpl(repoRoot);
  });

  afterEach(async () => {
    try {
      await rm(scratchRoot, { recursive: true, force: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('stages only the requested file', async () => {
    // Given
    await writeFile(join(repoRoot, literalPath), 'changed literal\n');
    await writeFile(join(repoRoot, matchingPath), 'changed matching\n');

    // When
    await service.stageFile(literalPath);

    // Then
    expect(await stagedPaths()).toEqual([literalPath]);
    expect(await readFile(join(repoRoot, matchingPath), 'utf8')).toBe('changed matching\n');
  });

  it('unstages only the requested file', async () => {
    // Given
    await writeFile(join(repoRoot, literalPath), 'changed literal\n');
    await writeFile(join(repoRoot, matchingPath), 'changed matching\n');
    await git('add', '-A');

    // When
    await service.unstageFile(literalPath);

    // Then
    expect(await stagedPaths()).toEqual([matchingPath]);
  });

  it('unstages only the requested file before the first commit', async () => {
    // Given: both files are staged, but HEAD does not exist yet
    await git('update-ref', '-d', 'HEAD');

    // When
    await service.unstageFile(literalPath);

    // Then: the initial-commit fallback must leave the matching path indexed
    expect(await git('ls-files', '-z')).toBe(`${matchingPath}\0`);
  });

  it('restores only the requested tracked file', async () => {
    // Given
    await writeFile(join(repoRoot, literalPath), 'changed literal\n');
    await writeFile(join(repoRoot, matchingPath), 'changed matching\n');

    // When
    await service.discardWorkingFile(literalPath);

    // Then
    expect(await readFile(join(repoRoot, literalPath), 'utf8')).toBe('original literal\n');
    expect(await readFile(join(repoRoot, matchingPath), 'utf8')).toBe('changed matching\n');
  });

  it('cleans only the requested untracked file', async () => {
    // Given
    const untrackedLiteral = 'app/[id]/new.tsx';
    const untrackedMatching = 'app/i/new.tsx';
    await writeFile(join(repoRoot, untrackedLiteral), 'literal\n');
    await writeFile(join(repoRoot, untrackedMatching), 'matching\n');

    // When
    await service.discardWorkingFile(untrackedLiteral);

    // Then
    expect(await git('ls-files', '--others', '--exclude-standard', '-z')).toBe(
      `${untrackedMatching}\0`,
    );
    expect(await readFile(join(repoRoot, untrackedMatching), 'utf8')).toBe('matching\n');
  });
});
