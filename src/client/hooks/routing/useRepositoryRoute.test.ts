import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRepositoryRoute } from './useRepositoryRoute';

function setPath(pathname: string): void {
  window.history.pushState(null, '', pathname);
}

describe('useRepositoryRoute', () => {
  afterEach(() => {
    setPath('/');
  });

  it('uses the repoId from /repos/:repoId', () => {
    // Given
    setPath('/repos/my-app');

    // When
    const { result } = renderHook(() => useRepositoryRoute('default'));

    // Then
    expect(result.current.repoId).toBe('my-app');
    expect(window.location.pathname).toBe('/repos/my-app');
  });

  it('replaces root with the temporary default repository route', () => {
    // Given
    setPath('/');

    // When
    const { result } = renderHook(() => useRepositoryRoute('default'));

    // Then
    expect(result.current.repoId).toBe('default');
    expect(window.location.pathname).toBe('/repos/default');
  });

  it('updates the repoId when browser history changes', () => {
    // Given
    setPath('/repos/sift');
    const { result } = renderHook(() => useRepositoryRoute('default'));

    // When
    act(() => {
      setPath('/repos/my-app');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Then
    expect(result.current.repoId).toBe('my-app');
  });

  it('pushes and applies repository navigation without waiting for popstate', () => {
    // Given
    setPath('/repos/sift');
    const { result } = renderHook(() => useRepositoryRoute('default'));

    // When
    act(() => {
      result.current.navigate('my-app');
    });

    // Then
    expect(window.location.pathname).toBe('/repos/my-app');
    expect(result.current.repoId).toBe('my-app');
  });
});
