import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { RepositoryHeadRefProvider } from './repository-head-ref-provider';

describe('RepositoryHeadRefProvider', () => {
  let getCurrentBranchName: Mock<() => Promise<string>>;
  let getShortHeadRevision: Mock<() => Promise<string>>;
  let provider: RepositoryHeadRefProvider;

  beforeEach(() => {
    getCurrentBranchName = vi.fn();
    getShortHeadRevision = vi.fn();
    provider = new RepositoryHeadRefProvider('/repo/root', {
      git: { getCurrentBranchName, getShortHeadRevision },
    });
  });

  it('reports the checked-out branch without asking for a revision', async () => {
    // Given
    getCurrentBranchName.mockResolvedValue('feature/add-branch-label');

    // When
    const head = await provider.getHeadRef();

    // Then
    expect(head).toEqual({ type: 'branch', name: 'feature/add-branch-label' });
    // A branch checkout already identifies HEAD, so no second Git call is needed.
    expect(getShortHeadRevision).not.toHaveBeenCalled();
  });

  it('falls back to the short revision when HEAD is detached', async () => {
    // Given: an empty branch name, which is how Git reports a detached HEAD
    getCurrentBranchName.mockResolvedValue('');
    getShortHeadRevision.mockResolvedValue('a1b2c3d');

    // When / Then
    await expect(provider.getHeadRef()).resolves.toEqual({
      type: 'detached',
      revision: 'a1b2c3d',
    });
  });

  it('reports unknown when neither a branch nor a revision is available', async () => {
    // Given: no branch and no commit to name it by
    getCurrentBranchName.mockResolvedValue('');
    getShortHeadRevision.mockResolvedValue('');

    // When / Then
    await expect(provider.getHeadRef()).resolves.toEqual({ type: 'unknown' });
  });

  it('reports unknown instead of propagating a Git failure', async () => {
    // Given: HEAD accompanies the diff for display only, so a Git failure must
    // not fail the diff read that embeds it
    getCurrentBranchName.mockRejectedValue(
      new Error('Git command failed: git branch --show-current'),
    );

    // When / Then
    await expect(provider.getHeadRef()).resolves.toEqual({ type: 'unknown' });
  });
});
