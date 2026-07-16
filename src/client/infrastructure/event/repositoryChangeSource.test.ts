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

  it('subscribes both event kinds over one repository-scoped connection', () => {
    // Given
    const onDiffChange = vi.fn();
    const onNotesChange = vi.fn();
    vi.stubGlobal('EventSource', FakeEventSource);

    // When
    const subscription = sseRepositoryChangeSource.subscribe('my-app', {
      onDiffChange,
      onNotesChange,
    });

    // Then: one connection carries both listeners
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('/api/repositories/my-app/watch');
    expect(FakeEventSource.instances[0].addEventListener).toHaveBeenCalledWith(
      'changed',
      onDiffChange,
    );
    expect(FakeEventSource.instances[0].addEventListener).toHaveBeenCalledWith(
      'notes-changed',
      onNotesChange,
    );

    // When
    subscription.unsubscribe();

    // Then
    expect(FakeEventSource.instances[0].close).toHaveBeenCalledTimes(1);
  });
});
