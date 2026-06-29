import { describe, it, expect } from 'vitest';
import {
  recordPreReadyIntent,
  resolveOpenDeliveryAction,
  type PreReadyOpenState,
} from './open-repository-delivery';

describe('recordPreReadyIntent', () => {
  const emptyState: PreReadyOpenState = { initialRepoId: null, pendingRepoIds: [] };

  it('should keep the state unchanged for a null intent', () => {
    // Given / When
    const next = recordPreReadyIntent(emptyState, null);

    // Then
    expect(next).toEqual({ initialRepoId: null, pendingRepoIds: [] });
  });

  it('should set the first repository as the initial route', () => {
    // Given / When
    const next = recordPreReadyIntent(emptyState, 'repo-a');

    // Then
    expect(next).toEqual({ initialRepoId: 'repo-a', pendingRepoIds: [] });
  });

  it('should queue repositories that arrive after the initial route is set', () => {
    // Given
    const state: PreReadyOpenState = { initialRepoId: 'repo-a', pendingRepoIds: [] };

    // When
    const next = recordPreReadyIntent(state, 'repo-b');

    // Then
    expect(next).toEqual({ initialRepoId: 'repo-a', pendingRepoIds: ['repo-b'] });
  });

  it('should preserve queue order across multiple pre-ready intents', () => {
    // Given / When
    const next = ['repo-a', 'repo-b', 'repo-c'].reduce<PreReadyOpenState>(
      recordPreReadyIntent,
      emptyState,
    );

    // Then: the first becomes the initial route, the rest keep arrival order.
    expect(next).toEqual({ initialRepoId: 'repo-a', pendingRepoIds: ['repo-b', 'repo-c'] });
  });

  it('should not mutate the input state', () => {
    // Given
    const state: PreReadyOpenState = { initialRepoId: 'repo-a', pendingRepoIds: [] };

    // When
    recordPreReadyIntent(state, 'repo-b');

    // Then
    expect(state).toEqual({ initialRepoId: 'repo-a', pendingRepoIds: [] });
  });
});

describe('resolveOpenDeliveryAction', () => {
  it('should focus only when no repository is requested', () => {
    // Given / When
    const action = resolveOpenDeliveryAction({
      repoId: null,
      windowAlreadyExists: true,
      canSend: true,
    });

    // Then
    expect(action).toEqual({ type: 'focus-only' });
  });

  it('should rely on the initial route when the window was just created', () => {
    // Given: a freshly created window is never ready to receive IPC yet.
    const action = resolveOpenDeliveryAction({
      repoId: 'repo-a',
      windowAlreadyExists: false,
      canSend: false,
    });

    // Then
    expect(action).toEqual({ type: 'load-initial' });
  });

  it('should send over IPC when the running renderer is ready', () => {
    // Given / When
    const action = resolveOpenDeliveryAction({
      repoId: 'repo-b',
      windowAlreadyExists: true,
      canSend: true,
    });

    // Then
    expect(action).toEqual({ type: 'send', repoId: 'repo-b' });
  });

  it('should queue when the running renderer is not ready', () => {
    // Given / When
    const action = resolveOpenDeliveryAction({
      repoId: 'repo-b',
      windowAlreadyExists: true,
      canSend: false,
    });

    // Then
    expect(action).toEqual({ type: 'queue', repoId: 'repo-b' });
  });
});
