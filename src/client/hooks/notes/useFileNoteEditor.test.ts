import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFileNoteEditor } from './useFileNoteEditor';

describe('useFileNoteEditor', () => {
  it('opens and closes when a file is selected', () => {
    // Given: the hook is rendered with a selected file
    const { result } = renderHook(() => useFileNoteEditor('file-a'));

    // When: open is invoked
    act(() => {
      result.current.open();
    });

    // Then: the editor becomes open
    expect(result.current.isOpen).toBe(true);

    // When: close is invoked
    act(() => {
      result.current.close();
    });

    // Then: the editor becomes closed
    expect(result.current.isOpen).toBe(false);
  });

  it('does not open when no file is selected', () => {
    // Given: the hook is rendered without a selected file
    const { result } = renderHook(() => useFileNoteEditor(null));

    // When: open is invoked
    act(() => {
      result.current.open();
    });

    // Then: the editor remains closed
    expect(result.current.isOpen).toBe(false);
  });

  it('closes when the selected file changes', () => {
    // Given: the editor is open for one file
    const { result, rerender } = renderHook(
      ({ selectedFileId }: { selectedFileId: string | null }) => useFileNoteEditor(selectedFileId),
      { initialProps: { selectedFileId: 'file-a' } },
    );
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    // When: the selected file changes
    rerender({ selectedFileId: 'file-b' });

    // Then: the editor closes
    expect(result.current.isOpen).toBe(false);
  });
});
