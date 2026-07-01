import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddCommandDependencies } from './add';
import { createAddCommand } from './add';

function createDependencies(): {
  addRepository: ReturnType<typeof vi.fn>;
  dependencies: AddCommandDependencies;
} {
  const addRepository = vi.fn().mockResolvedValue({
    id: 'sift-repo',
    name: 'sift',
    path: '/repo/sift',
  });

  return {
    addRepository,
    dependencies: {
      createRepositoryConfigUpdater: vi.fn(() => ({ addRepository })),
      resolveRepoRoot: vi.fn().mockReturnValue('/repo/sift'),
    },
  };
}

describe('createAddCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('adds the resolved repository path when a path argument is given', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    vi.mocked(dependencies.resolveRepoRoot).mockReturnValue('/resolved/repo');
    const command = createAddCommand(dependencies);

    // When
    await command.parseAsync(['/path'], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).toHaveBeenCalledWith('/path');
    expect(addRepository).toHaveBeenCalledWith('/resolved/repo');
    expect(console.log).toHaveBeenCalledWith('Repository registered as "sift-repo".');
  });

  it('adds the resolved current directory when no path argument is given', async () => {
    // Given
    const { addRepository, dependencies } = createDependencies();
    vi.mocked(dependencies.resolveRepoRoot).mockReturnValue('/resolved/current-directory');
    const command = createAddCommand(dependencies);

    // When
    await command.parseAsync([], { from: 'user' });

    // Then
    expect(dependencies.resolveRepoRoot).toHaveBeenCalledWith('.');
    expect(addRepository).toHaveBeenCalledWith('/resolved/current-directory');
  });
});
