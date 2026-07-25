import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryDiffProvider } from './repository-diff-provider';

const { readFileMock, lstatMock, readlinkMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  lstatMock: vi.fn(),
  readlinkMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
  lstat: lstatMock,
  readlink: readlinkMock,
}));

function createStats(size: number): {
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
  size: number;
} {
  return {
    isFile: () => true,
    isSymbolicLink: () => false,
    size,
  };
}

function createSymlinkStats(): { isFile: () => boolean; isSymbolicLink: () => boolean } {
  return {
    isFile: () => false,
    isSymbolicLink: () => true,
  };
}

function createProvider(untrackedFiles: string[]): RepositoryDiffProvider {
  const provider = new RepositoryDiffProvider('/repo/root');
  const gitClientMock = {
    repoRoot: '/repo/root',
    getDiffOutput: vi.fn().mockResolvedValue(''),
    getUntrackedFiles: vi.fn().mockResolvedValue(untrackedFiles),
  };

  (provider as unknown as { gitClient: typeof gitClientMock }).gitClient = gitClientMock;

  return provider;
}

function createStrictProvider(gitClientMock: {
  repoRoot: string;
  getDiffOutput: ReturnType<typeof vi.fn>;
  getUntrackedFiles: ReturnType<typeof vi.fn>;
}): RepositoryDiffProvider {
  const provider = new RepositoryDiffProvider('/repo/root', { errorMode: 'throw' });
  (provider as unknown as { gitClient: typeof gitClientMock }).gitClient = gitClientMock;
  return provider;
}

describe('RepositoryDiffProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a text diff for small untracked text files', async () => {
    // Given: an untracked file is small enough to render and contains no NUL bytes
    lstatMock.mockResolvedValue(createStats(11));
    readFileMock.mockResolvedValue(Buffer.from('hello\nworld', 'utf8'));
    const provider = createProvider(['notes.txt']);

    // When
    const files = await provider.getFiles('working');

    // Then
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: 'notes.txt',
      status: 'untracked',
      kind: 'text',
    });
    expect(files[0].hunks[0].lines.map((line) => line.content)).toEqual(['hello', 'world']);
  });

  it('does not render a trailing newline in an untracked text file as an extra blank line', async () => {
    // Given: an untracked text file ends with the conventional newline terminator
    lstatMock.mockResolvedValue(createStats(12));
    readFileMock.mockResolvedValue(Buffer.from('hello\nworld\n', 'utf8'));
    const provider = createProvider(['notes.txt']);

    // When
    const files = await provider.getFiles('working');

    // Then
    expect(files[0].hunks[0].newLines).toBe(2);
    expect(files[0].hunks[0].lines.map((line) => line.content)).toEqual(['hello', 'world']);
  });

  it('preserves intentional blank lines before the trailing newline in untracked text files', async () => {
    // Given: the file has an actual blank line before the final newline terminator
    lstatMock.mockResolvedValue(createStats(7));
    readFileMock.mockResolvedValue(Buffer.from('hello\n\n', 'utf8'));
    const provider = createProvider(['notes.txt']);

    // When
    const files = await provider.getFiles('working');

    // Then
    expect(files[0].hunks[0].newLines).toBe(2);
    expect(files[0].hunks[0].lines.map((line) => line.content)).toEqual(['hello', '']);
  });

  it('keeps empty untracked text files visible without adding a synthetic blank line', async () => {
    // Given: an untracked text file has no content
    lstatMock.mockResolvedValue(createStats(0));
    readFileMock.mockResolvedValue(Buffer.from('', 'utf8'));
    const provider = createProvider(['empty.txt']);

    // When
    const files = await provider.getFiles('working');

    // Then
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: 'empty.txt',
      status: 'untracked',
      kind: 'text',
      hunks: [],
    });
  });

  it('marks untracked binary files as binary instead of rendering their bytes as text', async () => {
    // Given: an untracked file has binary-looking bytes
    lstatMock.mockResolvedValue(createStats(5));
    readFileMock.mockResolvedValue(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));
    const provider = createProvider(['build/app.jar']);

    // When
    const files = await provider.getFiles('working');

    // Then
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: 'build/app.jar',
      status: 'untracked',
      kind: 'binary',
      hunks: [],
    });
  });

  it('does not read oversized untracked files into the diff response', async () => {
    // Given: an untracked file is too large to safely render as a synthetic text diff
    lstatMock.mockResolvedValue(createStats(1024 * 1024));
    const provider = createProvider(['target/app.jar']);

    // When
    const files = await provider.getFiles('working');

    // Then
    expect(readFileMock).not.toHaveBeenCalled();
    expect(files[0]).toMatchObject({
      path: 'target/app.jar',
      status: 'untracked',
      kind: 'binary',
      hunks: [],
    });
  });

  it('renders an untracked symlink as its link-target string instead of the linked file content', async () => {
    // Given: an untracked symlink points at a file elsewhere in the repo
    lstatMock.mockResolvedValue(createSymlinkStats());
    readlinkMock.mockResolvedValue('target/real-file.txt');
    const provider = createProvider(['link.txt']);

    // When
    const files = await provider.getFiles('working');

    // Then: the link target string is the content, and the linked file is never read
    expect(readFileMock).not.toHaveBeenCalled();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: 'link.txt',
      status: 'untracked',
      kind: 'text',
    });
    expect(files[0].hunks[0].lines.map((line) => line.content)).toEqual(['target/real-file.txt']);
  });

  it('renders an untracked symlink pointing outside the repository as its link-target string, not the external file content', async () => {
    // Given: an untracked symlink escapes the repository root
    lstatMock.mockResolvedValue(createSymlinkStats());
    readlinkMock.mockResolvedValue('/etc/passwd');
    const provider = createProvider(['escape-link']);

    // When
    const files = await provider.getFiles('working');

    // Then: the external file is never read; only the link text is shown
    expect(readFileMock).not.toHaveBeenCalled();
    expect(files[0].hunks[0].lines.map((line) => line.content)).toEqual(['/etc/passwd']);
  });

  it('propagates Git diff failures in strict mode', async () => {
    // Given: a strict provider whose diff command fails
    const error = new Error('git diff failed');
    const provider = createStrictProvider({
      repoRoot: '/repo/root',
      getDiffOutput: vi.fn().mockRejectedValue(error),
      getUntrackedFiles: vi.fn().mockResolvedValue([]),
    });

    // When / Then: the failure is exposed instead of becoming an empty diff
    await expect(provider.getFiles('staged')).rejects.toBe(error);
  });

  it('propagates untracked-file discovery failures in strict mode', async () => {
    // Given: tracked diff loading succeeds but untracked discovery fails
    const error = new Error('git ls-files failed');
    const provider = createStrictProvider({
      repoRoot: '/repo/root',
      getDiffOutput: vi.fn().mockResolvedValue(''),
      getUntrackedFiles: vi.fn().mockRejectedValue(error),
    });

    // When / Then: the working pane is not returned as a trustworthy empty result
    await expect(provider.getFiles('working')).rejects.toBe(error);
  });

  it('propagates untracked-file read failures in strict mode', async () => {
    // Given: an untracked file is discovered but cannot be inspected
    const error = new Error('stat failed');
    lstatMock.mockRejectedValue(error);
    const provider = createStrictProvider({
      repoRoot: '/repo/root',
      getDiffOutput: vi.fn().mockResolvedValue(''),
      getUntrackedFiles: vi.fn().mockResolvedValue(['notes.txt']),
    });

    // When / Then: reconcile callers can abort instead of losing the line anchor
    await expect(provider.getFiles('working')).rejects.toBe(error);
  });
});
