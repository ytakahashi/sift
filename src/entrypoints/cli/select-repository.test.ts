import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedRepository } from '../../domain/repository/repository';
import { selectRepositoryInteractively } from './select-repository';

const { autocomplete, cancel, isCancel } = vi.hoisted(() => ({
  autocomplete: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({ autocomplete, cancel, isCancel }));

function createRepository(overrides: Partial<ResolvedRepository> = {}): ResolvedRepository {
  return {
    id: 'sift-abc123',
    name: 'sift',
    path: '/repo/sift',
    ...overrides,
  };
}

describe('selectRepositoryInteractively', () => {
  const originalIsTTY = process.stdin.isTTY;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalIsTTY });
  });

  it('converts repositories to autocomplete options and returns the selected repository', async () => {
    // Given
    const repo1 = createRepository({ id: 'sift', name: 'sift', path: '/repo/sift' });
    const repo2 = createRepository({
      id: 'design-sift',
      name: 'design-sift',
      path: '/repo/design-sift',
    });
    isCancel.mockReturnValue(false);
    autocomplete.mockResolvedValue(repo2);

    // When
    const selected = await selectRepositoryInteractively([repo1, repo2]);

    // Then
    expect(autocomplete).toHaveBeenCalledWith({
      message: 'Select a repository to open',
      options: [
        { value: repo1, label: 'sift', hint: '/repo/sift' },
        { value: repo2, label: 'design-sift', hint: '/repo/design-sift' },
      ],
    });
    expect(selected).toBe(repo2);
  });

  it('returns null and shows a cancellation message when the selection is cancelled', async () => {
    // Given
    const repo = createRepository();
    const cancelSymbol = Symbol('cancel');
    autocomplete.mockResolvedValue(cancelSymbol);
    isCancel.mockReturnValue(true);

    // When
    const selected = await selectRepositoryInteractively([repo]);

    // Then
    expect(selected).toBeNull();
    expect(cancel).toHaveBeenCalledWith('Selection cancelled.');
  });

  it('returns null without prompting when stdin is not a TTY', async () => {
    // Given
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    const repo = createRepository();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // When
    const selected = await selectRepositoryInteractively([repo]);

    // Then
    expect(selected).toBeNull();
    expect(autocomplete).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Interactive selection requires a terminal (stdin is not a TTY).',
    );
  });
});
