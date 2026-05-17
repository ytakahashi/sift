import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRepositoryTabs } from './useRepositoryTabs';

describe('useRepositoryTabs', () => {
  it('appends a new tab to the end and uses id as placeholder name', () => {
    // Given: the hook starts with no tabs
    const { result } = renderHook(() => useRepositoryTabs());

    // When: a new tab is opened without a name
    act(() => {
      result.current.openTab('repo-a');
    });

    // Then: the tab is appended and its name is the id placeholder
    expect(result.current.tabs).toEqual([{ id: 'repo-a', name: 'repo-a' }]);
  });

  it('uses the provided name when opening a new tab', () => {
    // Given: the hook starts with no tabs
    const { result } = renderHook(() => useRepositoryTabs());

    // When: a tab is opened with a name
    act(() => {
      result.current.openTab('repo-a', 'Repository A');
    });

    // Then: the tab is appended with the provided name
    expect(result.current.tabs).toEqual([{ id: 'repo-a', name: 'Repository A' }]);
  });

  it('does not duplicate when opening an existing tab', () => {
    // Given: a tab is already open
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a', 'Repository A');
      result.current.openTab('repo-b');
    });

    // When: an existing tab is opened again
    act(() => {
      result.current.openTab('repo-a');
    });

    // Then: the tabs array is unchanged
    expect(result.current.tabs).toEqual([
      { id: 'repo-a', name: 'Repository A' },
      { id: 'repo-b', name: 'repo-b' },
    ]);
  });

  it('upgrades a placeholder name when openTab is called again with a real name', () => {
    // Given: a tab is opened with no name and falls back to the id
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a');
    });
    expect(result.current.tabs[0].name).toBe('repo-a');

    // When: openTab is called again with a real name
    act(() => {
      result.current.openTab('repo-a', 'Repository A');
    });

    // Then: the placeholder name is replaced
    expect(result.current.tabs).toEqual([{ id: 'repo-a', name: 'Repository A' }]);
  });

  it('does not overwrite a resolved name when openTab is called again', () => {
    // Given: a tab has a resolved name (different from its id)
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a', 'Repository A');
    });

    // When: openTab is called again with a different name
    act(() => {
      result.current.openTab('repo-a', 'Different Name');
    });

    // Then: the existing resolved name is preserved
    expect(result.current.tabs).toEqual([{ id: 'repo-a', name: 'Repository A' }]);
  });

  it('setTabName updates an existing tab name', () => {
    // Given: a tab is open with the id placeholder
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a');
    });

    // When: setTabName is invoked
    act(() => {
      result.current.setTabName('repo-a', 'Repository A');
    });

    // Then: the tab name is updated
    expect(result.current.tabs).toEqual([{ id: 'repo-a', name: 'Repository A' }]);
  });

  it('setTabName is a no-op for an unknown id', () => {
    // Given: a tab is open
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a', 'Repository A');
    });
    const before = result.current.tabs;

    // When: setTabName is called for an id that is not in the list
    act(() => {
      result.current.setTabName('repo-unknown', 'Other');
    });

    // Then: the state reference is unchanged (no spurious re-render)
    expect(result.current.tabs).toBe(before);
  });

  it('closeTab removes the target and returns the left neighbor', () => {
    // Given: three tabs are open in order a, b, c
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a');
      result.current.openTab('repo-b');
      result.current.openTab('repo-c');
    });

    // When: the middle tab is closed
    let next: string | null = '';
    act(() => {
      next = result.current.closeTab('repo-b');
    });

    // Then: the left neighbor is returned as the next active id
    expect(next).toBe('repo-a');
    expect(result.current.tabs.map((tab) => tab.id)).toEqual(['repo-a', 'repo-c']);
  });

  it('closeTab returns the right neighbor when no left neighbor exists', () => {
    // Given: two tabs are open
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a');
      result.current.openTab('repo-b');
    });

    // When: the leftmost tab is closed
    let next: string | null = '';
    act(() => {
      next = result.current.closeTab('repo-a');
    });

    // Then: the right neighbor becomes the next active id
    expect(next).toBe('repo-b');
    expect(result.current.tabs.map((tab) => tab.id)).toEqual(['repo-b']);
  });

  it('closeTab returns null when the last tab is closed', () => {
    // Given: a single tab is open
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a');
    });

    // When: that tab is closed
    let next: string | null = 'unset';
    act(() => {
      next = result.current.closeTab('repo-a');
    });

    // Then: there is no next active id and the list is empty
    expect(next).toBeNull();
    expect(result.current.tabs).toEqual([]);
  });

  it('closeTab returns null for an unknown id without mutating state', () => {
    // Given: a tab is open
    const { result } = renderHook(() => useRepositoryTabs());
    act(() => {
      result.current.openTab('repo-a');
    });
    const before = result.current.tabs;

    // When: closeTab is called for an unknown id
    let next: string | null = 'unset';
    act(() => {
      next = result.current.closeTab('repo-unknown');
    });

    // Then: null is returned and the tab list is unchanged
    expect(next).toBeNull();
    expect(result.current.tabs).toBe(before);
  });
});
