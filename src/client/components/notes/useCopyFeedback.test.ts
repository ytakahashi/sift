import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCopyFeedback } from './useCopyFeedback';

describe('useCopyFeedback', () => {
  const originalClipboard = navigator.clipboard;
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('sets copied to true after a successful clipboard write, then auto-clears after 2 seconds', async () => {
    // Given: a successful clipboard write
    writeText.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyFeedback());
    expect(result.current.copied).toBe(false);

    // When: copy is called
    await act(async () => {
      result.current.copy('hello');
    });

    // Then: the clipboard receives the text and copied becomes true
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result.current.copied).toBe(true);

    // When: 2 seconds elapse
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Then: copied auto-clears
    expect(result.current.copied).toBe(false);
  });

  it('logs the error and leaves copied false when the clipboard write rejects with an Error', async () => {
    // Given: a clipboard write that rejects with an Error
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    writeText.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useCopyFeedback());

    // When: copy is called
    await act(async () => {
      result.current.copy('hello');
    });

    // Then: the failure is logged and copied stays false
    expect(consoleError).toHaveBeenCalledWith('Failed to copy note(s):', 'denied');
    expect(result.current.copied).toBe(false);

    consoleError.mockRestore();
  });

  it('does not log when the clipboard write rejects with a non-Error value', async () => {
    // Given: a clipboard write that rejects with a non-Error value
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    writeText.mockRejectedValue('denied');
    const { result } = renderHook(() => useCopyFeedback());

    // When: copy is called
    await act(async () => {
      result.current.copy('hello');
    });

    // Then: nothing is logged
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
