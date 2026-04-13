import { describe, expect, it, vi } from 'vitest';
import { runOptimisticPaneAction } from './pane-action';

describe('runOptimisticPaneAction', () => {
  it('applies the optimistic update, calls serverCall, and returns true on success', async () => {
    // Given: all callbacks are mocked and serverCall resolves
    const getSnapshot = vi.fn(() => 'snapshot-value');
    const applyOptimistic = vi.fn();
    const serverCall = vi.fn().mockResolvedValue(undefined);
    const rollback = vi.fn();

    // When
    const result = await runOptimisticPaneAction(
      getSnapshot,
      applyOptimistic,
      serverCall,
      rollback,
    );

    // Then: optimistic update was applied, rollback was not called, result is true
    expect(applyOptimistic).toHaveBeenCalledOnce();
    expect(serverCall).toHaveBeenCalledOnce();
    expect(rollback).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('applies the optimistic update, calls rollback with the snapshot, and returns false on failure', async () => {
    // Given: serverCall rejects
    const getSnapshot = vi.fn(() => 'snap');
    const applyOptimistic = vi.fn();
    const serverCall = vi.fn().mockRejectedValue(new Error('network error'));
    const rollback = vi.fn();

    // When
    const result = await runOptimisticPaneAction(
      getSnapshot,
      applyOptimistic,
      serverCall,
      rollback,
    );

    // Then: rollback receives the exact snapshot value returned by getSnapshot
    expect(applyOptimistic).toHaveBeenCalledOnce();
    expect(rollback).toHaveBeenCalledWith('snap');
    expect(result).toBe(false);
  });

  it('passes a typed snapshot to rollback without losing type information', async () => {
    // Given: snapshot is an array (verifies the generic type parameter is preserved)
    const snapshot = [1, 2, 3];
    const getSnapshot = vi.fn(() => snapshot);
    const rollback = vi.fn();
    const serverCall = vi.fn().mockRejectedValue(new Error('fail'));

    // When
    await runOptimisticPaneAction(getSnapshot, vi.fn(), serverCall, rollback);

    // Then: the exact array reference is passed to rollback
    expect(rollback).toHaveBeenCalledWith(snapshot);
  });
});
