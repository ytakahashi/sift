import { afterEach, describe, expect, it, vi } from 'vitest';
import { sseRepositoryChangeSource } from './repositoryChangeSource';

class FakeEventSource {
  static readonly instances: FakeEventSource[] = [];

  readonly addEventListener = vi.fn();
  readonly close = vi.fn();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
}

describe('sseRepositoryChangeSource', () => {
  afterEach(() => {
    FakeEventSource.instances.length = 0;
    vi.unstubAllGlobals();
  });

  it('subscribes to the repository-scoped watch endpoint', () => {
    // Given
    const onChange = vi.fn();
    vi.stubGlobal('EventSource', FakeEventSource);

    // When
    const subscription = sseRepositoryChangeSource.subscribe('my-app', onChange);

    // Then
    expect(FakeEventSource.instances[0].url).toBe('/api/repositories/my-app/watch');
    expect(FakeEventSource.instances[0].addEventListener).toHaveBeenCalledWith('changed', onChange);

    // When
    subscription.unsubscribe();

    // Then
    expect(FakeEventSource.instances[0].close).toHaveBeenCalledTimes(1);
  });
});
