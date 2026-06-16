import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryDiffProvider } from './repository-diff-provider';

const { readFileMock, statMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
  statMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: readFileMock,
  stat: statMock,
}));

function createStats(size: number): { isFile: () => boolean; size: number } {
  return {
    isFile: () => true,
    size,
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

describe('RepositoryDiffProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a text diff for small untracked text files', async () => {
    // Given: an untracked file is small enough to render and contains no NUL bytes
    statMock.mockResolvedValue(createStats(11));
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
    statMock.mockResolvedValue(createStats(12));
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
    statMock.mockResolvedValue(createStats(7));
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
    statMock.mockResolvedValue(createStats(0));
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
    statMock.mockResolvedValue(createStats(5));
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
    statMock.mockResolvedValue(createStats(1024 * 1024));
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
});
