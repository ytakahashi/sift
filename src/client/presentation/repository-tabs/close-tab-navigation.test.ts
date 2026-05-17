import { describe, expect, it } from 'vitest';
import { resolveCloseTabNavigation } from './close-tab-navigation';

describe('resolveCloseTabNavigation', () => {
  it('returns none when closing a non-active tab', () => {
    // Given: the user closes a tab that is not the active one
    // When / Then: the current route should stay
    expect(resolveCloseTabNavigation('repo-a', 'repo-b', 'repo-c')).toEqual({ type: 'none' });
  });

  it('returns none when no tab is active', () => {
    // Given: nothing is active (e.g., the user is on the selection page)
    // When / Then: closing a tab does not change the route
    expect(resolveCloseTabNavigation('repo-a', null, 'repo-b')).toEqual({ type: 'none' });
  });

  it('navigates to the neighbor when closing the active tab', () => {
    // Given: the active tab is closed and a neighbor exists
    // When / Then: the neighbor becomes the next route target
    expect(resolveCloseTabNavigation('repo-a', 'repo-a', 'repo-b')).toEqual({
      type: 'repository',
      repoId: 'repo-b',
    });
  });

  it('navigates to selection when closing the last remaining tab', () => {
    // Given: the active tab is the only one and no neighbor remains
    // When / Then: the app should fall back to the selection page
    expect(resolveCloseTabNavigation('repo-a', 'repo-a', null)).toEqual({ type: 'selection' });
  });
});
