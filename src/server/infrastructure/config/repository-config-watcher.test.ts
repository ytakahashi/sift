import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryConfigWatcher } from './repository-config-watcher';
import { readRepositoryConfig, type RepositoryConfigReadResult } from './repository-config-reader';

type WatchHandler = () => void;

const { closeMock, watchMock } = vi.hoisted(() => ({
  closeMock: vi.fn().mockResolvedValue(undefined),
  watchMock: vi.fn(),
}));

vi.mock('chokidar', () => ({
  default: {
    watch: watchMock,
  },
}));

vi.mock('./repository-config-reader', () => ({
  readRepositoryConfig: vi.fn(),
}));

let allHandler: WatchHandler = () => {
  throw new Error('Expected watch handler to be registered.');
};

describe('RepositoryConfigWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allHandler = () => {
      throw new Error('Expected watch handler to be registered.');
    };

    watchMock.mockImplementation(() => ({
      on: vi.fn((event: string, handler: WatchHandler) => {
        if (event === 'all') {
          allHandler = handler;
        }
      }),
      close: closeMock,
    }));
  });

  it('reads config and caches the result', async () => {
    // Given
    const mockResult = {
      configPath: 'test.json',
      status: 'missing',
    } as unknown as RepositoryConfigReadResult;
    vi.mocked(readRepositoryConfig).mockResolvedValueOnce(mockResult);

    const watcher = new RepositoryConfigWatcher('test.json');

    // When
    const result1 = await watcher.readConfig();
    const result2 = await watcher.readConfig();

    // Then
    expect(result1).toBe(mockResult);
    expect(result2).toBe(mockResult);
    expect(readRepositoryConfig).toHaveBeenCalledTimes(1);
    expect(readRepositoryConfig).toHaveBeenCalledWith('test.json');
  });

  it('starts watching the config file on the first read', async () => {
    // Given
    vi.mocked(readRepositoryConfig).mockResolvedValueOnce(
      {} as unknown as RepositoryConfigReadResult,
    );

    const watcher = new RepositoryConfigWatcher('test.json');

    // When
    await watcher.readConfig();

    // Then
    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(watchMock).toHaveBeenCalledWith(
      'test.json',
      expect.objectContaining({
        ignoreInitial: true,
        persistent: true,
      }),
    );
  });

  it('clears the cache when a file change is detected', async () => {
    // Given
    const mockResult1 = { status: 'missing' } as unknown as RepositoryConfigReadResult;
    const mockResult2 = { status: 'found' } as unknown as RepositoryConfigReadResult;
    vi.mocked(readRepositoryConfig)
      .mockResolvedValueOnce(mockResult1)
      .mockResolvedValueOnce(mockResult2);

    const watcher = new RepositoryConfigWatcher('test.json');
    await watcher.readConfig();

    // When
    expect(allHandler).not.toBeNull();
    allHandler();

    const result2 = await watcher.readConfig();

    // Then
    expect(result2).toBe(mockResult2);
    expect(readRepositoryConfig).toHaveBeenCalledTimes(2);
  });

  it('stops the watcher', async () => {
    // Given
    vi.mocked(readRepositoryConfig).mockResolvedValueOnce(
      {} as unknown as RepositoryConfigReadResult,
    );

    const watcher = new RepositoryConfigWatcher('test.json');
    await watcher.readConfig();

    // When
    await watcher.stop();

    // Then
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing if stop is called before watching starts', async () => {
    // Given
    const watcher = new RepositoryConfigWatcher('test.json');

    // When
    await watcher.stop();

    // Then
    expect(closeMock).not.toHaveBeenCalled();
  });
});
