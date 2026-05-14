import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryList } from '../../../domain/repository/repository';
import { RepositorySelection } from './RepositorySelection';

type RepositorySelectionComponentProps = ComponentProps<typeof RepositorySelection>;

function createRepositorySelectionProps(
  repositories: RepositoryList | null,
  overrides: Partial<RepositorySelectionComponentProps> = {},
): RepositorySelectionComponentProps {
  return {
    addError: null,
    adding: false,
    configMissingError: null,
    editError: null,
    error: null,
    loading: false,
    onAddRepository: vi.fn().mockResolvedValue(true),
    onCommitRepositoryListEdits: vi.fn().mockResolvedValue(true),
    onRefresh: vi.fn(),
    onSelectRepository: vi.fn(),
    repositories,
    saving: false,
    clearEditError: vi.fn(),
    ...overrides,
  };
}

function renderRepositorySelection(
  repositories: RepositoryList,
  overrides: Partial<RepositorySelectionComponentProps> = {},
): RepositorySelectionComponentProps {
  const props = createRepositorySelectionProps(repositories, overrides);
  render(<RepositorySelection {...props} />);
  return props;
}

function createDataTransfer(): DataTransfer {
  const data = new Map<string, string>();
  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    getData: vi.fn((type: string) => data.get(type) ?? ''),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
    }),
  } as unknown as DataTransfer;
}

describe('RepositorySelection', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows invalid repositories with their reason', () => {
    // Given
    renderRepositorySelection({
      invalidRepositories: [
        {
          id: 'missing-repo',
          name: 'missing-repo',
          path: '/repo/missing-repo',
          reason: 'Repository path does not exist.',
        },
      ],
      repositories: [],
    });

    // Then
    expect(screen.getByText('missing-repo')).toBeDefined();
    expect(screen.getByText('Repository path does not exist.')).toBeDefined();
  });

  it('does not render invalid repositories as selectable buttons', () => {
    // Given
    const { onSelectRepository } = renderRepositorySelection({
      invalidRepositories: [
        {
          id: 'invalid-repo',
          name: 'invalid-repo',
          path: '/repo/invalid-repo',
          reason: 'Repository path is not a Git repository.',
        },
      ],
      repositories: [],
    });

    // Then
    expect(screen.queryByRole('button', { name: /invalid-repo/ })).toBeNull();
    expect(onSelectRepository).not.toHaveBeenCalled();
  });

  it('shows the config missing error from the fetch status handling', () => {
    // Given / When
    render(
      <RepositorySelection
        {...createRepositorySelectionProps(null, {
          configMissingError:
            'Repository config is missing: /Users/example/.config/sift/config.json',
        })}
      />,
    );

    // Then
    expect(
      screen.getByText('Repository config is missing: /Users/example/.config/sift/config.json'),
    ).toBeDefined();
  });

  it('opens an add repository form and submits the entered path', async () => {
    // Given
    const user = userEvent.setup();
    const { onAddRepository } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));
    await user.type(screen.getByRole('textbox', { name: 'Repository path' }), '/repo/sift');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    // Then
    expect(onAddRepository).toHaveBeenCalledWith('/repo/sift');
    expect(screen.queryByRole('textbox', { name: 'Repository path' })).toBeNull();
  });

  it('keeps the add repository form open when submission fails', async () => {
    // Given
    const user = userEvent.setup();
    const onAddRepository = vi.fn().mockResolvedValue(false);
    render(
      <RepositorySelection
        {...createRepositorySelectionProps(
          {
            invalidRepositories: [],
            repositories: [],
          },
          {
            addError: 'Repository path is not a directory.',
            onAddRepository,
          },
        )}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));
    await user.type(screen.getByRole('textbox', { name: 'Repository path' }), '/repo/sift');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    // Then
    expect(onAddRepository).toHaveBeenCalledWith('/repo/sift');
    expect(screen.getByRole('textbox', { name: 'Repository path' })).toBeDefined();
    expect(screen.getByText('Repository path is not a directory.')).toBeDefined();
    expect(screen.queryByText('Repository path is not a directory.')?.closest('header')).toBeNull();
  });

  it('disables add repository controls while adding', async () => {
    // Given
    const user = userEvent.setup();
    render(
      <RepositorySelection
        {...createRepositorySelectionProps(
          {
            invalidRepositories: [],
            repositories: [],
          },
          { adding: true },
        )}
      />,
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));

    // Then
    expect(screen.getByRole('textbox', { name: 'Repository path' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Adding...' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
  });

  it('toggles edit mode and shows delete controls', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'my-app', name: 'my-app', path: '/repo/my-app' },
      ],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    // Then
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove sift' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove my-app' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add Repository' })).toHaveProperty('disabled', true);
  });

  it('disables selection while editing', async () => {
    // Given
    const user = userEvent.setup();
    const { onSelectRepository } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'sift/repo/sift' }));

    // Then
    expect(onSelectRepository).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'sift/repo/sift' })).toHaveProperty('disabled', true);
  });

  it('shows drag handles only for resolved repositories while editing', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [
        { id: 'invalid-repo', name: 'invalid-repo', path: '/repo/invalid', reason: 'Missing' },
      ],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    // Then
    expect(screen.getByRole('button', { name: 'Drag sift' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Drag invalid-repo' })).toBeNull();
  });

  it('sets aria-grabbed attribute during dragging', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    const row = screen.getByRole('listitem');
    const dataTransfer = createDataTransfer();

    // Then (initial state)
    expect(row.getAttribute('aria-grabbed')).toBe('false');

    // When (dragging starts)
    fireEvent.dragStart(row, { dataTransfer });

    // Then
    expect(row.getAttribute('aria-grabbed')).toBe('true');

    // When (dragging ends)
    fireEvent.dragEnd(row);

    // Then
    expect(row.getAttribute('aria-grabbed')).toBe('false');
  });

  it('commits a reordered resolved repository list after drag and drop (before target)', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'my-app', name: 'my-app', path: '/repo/my-app' },
      ],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getAllByRole('listitem')[1], { dataTransfer });

    // Mock getBoundingClientRect on the prototype to be safe against re-renders
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        top: 100,
        height: 80,
      } as DOMRect);

    const targetRow = screen.getAllByRole('listitem')[0];
    const dragOverEvent = createEvent.dragOver(targetRow);
    Object.defineProperty(dragOverEvent, 'clientY', { value: 110 });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(targetRow, dragOverEvent);

    const dropEvent = createEvent.drop(screen.getAllByRole('listitem')[0]);
    Object.defineProperty(dropEvent, 'clientY', { value: 110 });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(screen.getAllByRole('listitem')[0], dropEvent);

    getBoundingClientRect.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onCommitRepositoryListEdits).toHaveBeenCalledWith([], ['my-app', 'sift']);
  });

  it('commits a reordered resolved repository list after drag and drop (after target)', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'my-app', name: 'my-app', path: '/repo/my-app' },
      ],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getAllByRole('listitem')[1], { dataTransfer });

    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        top: 100,
        height: 80,
      } as DOMRect);

    const targetRow = screen.getAllByRole('listitem')[0];
    const dragOverEvent = createEvent.dragOver(targetRow);
    Object.defineProperty(dragOverEvent, 'clientY', { value: 150 });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(targetRow, dragOverEvent);

    const dropEvent = createEvent.drop(screen.getAllByRole('listitem')[0]);
    Object.defineProperty(dropEvent, 'clientY', { value: 150 });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(screen.getAllByRole('listitem')[0], dropEvent);

    getBoundingClientRect.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    // Moving my-app after sift keeps the order as ['sift', 'my-app']
    expect(onCommitRepositoryListEdits).not.toHaveBeenCalled();
  });

  it('commits a reordered resolved repository list after drag and drop to the end of the list', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'my-app', name: 'my-app', path: '/repo/my-app' },
      ],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getAllByRole('listitem')[0], { dataTransfer });

    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        top: 200,
        height: 80,
      } as DOMRect);

    const targetRow = screen.getAllByRole('listitem')[1];
    const dragOverEvent = createEvent.dragOver(targetRow);
    Object.defineProperty(dragOverEvent, 'clientY', { value: 250 });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(targetRow, dragOverEvent);

    const dropEvent = createEvent.drop(screen.getAllByRole('listitem')[1]);
    Object.defineProperty(dropEvent, 'clientY', { value: 250 });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(screen.getAllByRole('listitem')[1], dropEvent);

    getBoundingClientRect.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onCommitRepositoryListEdits).toHaveBeenCalledWith([], ['my-app', 'sift']);
  });

  it('disables dragging for pending delete rows', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove sift' }));

    // Then
    expect(screen.getByRole('button', { name: 'Drag sift' })).toHaveProperty('disabled', true);
  });

  it('marks a repository as pending delete without committing immediately', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [
        { id: 'invalid-repo', name: 'invalid-repo', path: '/repo/invalid', reason: 'Missing' },
      ],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove invalid-repo' }));

    // Then
    expect(screen.getByRole('button', { name: 'Undo remove invalid-repo' })).toBeDefined();
    expect(onCommitRepositoryListEdits).not.toHaveBeenCalled();
  });

  it('toggles a pending delete off and exits without calling the API when no rows are pending', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove sift' }));
    await user.click(screen.getByRole('button', { name: 'Undo remove sift' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onCommitRepositoryListEdits).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit Repository List' })).toBeDefined();
  });

  it('cancels pending deletes without calling the API', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove sift' }));
    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));

    // Then
    expect(onCommitRepositoryListEdits).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit Repository List' })).toBeDefined();
  });

  it('commits pending deletes on Done', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [
        { id: 'invalid-repo', name: 'invalid-repo', path: '/repo/invalid', reason: 'Missing' },
      ],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove invalid-repo' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onCommitRepositoryListEdits).toHaveBeenCalledWith(['invalid-repo'], []);
    expect(screen.getByRole('button', { name: 'Edit Repository List' })).toBeDefined();
  });

  it('commits pending deletes and remaining order together on Done', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'my-app', name: 'my-app', path: '/repo/my-app' },
        { id: 'other-repo', name: 'other-repo', path: '/repo/other-repo' },
      ],
    });

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getAllByRole('listitem')[2], { dataTransfer });

    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        top: 100,
        height: 80,
      } as DOMRect);

    const targetRow = screen.getAllByRole('listitem')[0];
    const dragOverEvent = createEvent.dragOver(targetRow);
    Object.defineProperty(dragOverEvent, 'clientY', { value: 110 });
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(targetRow, dragOverEvent);

    const dropEvent = createEvent.drop(screen.getAllByRole('listitem')[0]);
    Object.defineProperty(dropEvent, 'clientY', { value: 110 });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
    fireEvent(screen.getAllByRole('listitem')[0], dropEvent);

    getBoundingClientRect.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Remove my-app' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onCommitRepositoryListEdits).toHaveBeenCalledWith(['my-app'], ['other-repo', 'sift']);
  });

  it('keeps edit mode and clears pending state when committing deletes fails', async () => {
    // Given
    const user = userEvent.setup();
    const onCommitRepositoryListEdits = vi.fn().mockResolvedValue(false);
    renderRepositorySelection(
      {
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      },
      { onCommitRepositoryListEdits },
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove sift' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onCommitRepositoryListEdits).toHaveBeenCalledWith(['sift'], []);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Undo remove sift' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove sift' })).toBeDefined();
  });

  it('clears editError when Cancel exits edit mode', async () => {
    // Given
    const user = userEvent.setup();
    const clearEditError = vi.fn();
    renderRepositorySelection(
      {
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      },
      {
        clearEditError,
        editError: 'Failed to delete repository.',
      },
    );

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    clearEditError.mockClear();
    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));

    // Then
    expect(clearEditError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Edit Repository List' })).toBeDefined();
  });

  it('displays editError when provided', () => {
    // Given / When
    render(
      <RepositorySelection
        {...createRepositorySelectionProps(null, { editError: 'Repository not found.' })}
      />,
    );

    // Then
    expect(screen.getByText('Repository not found.')).toBeDefined();
  });

  it('maintains edit mode controls when rerendered with an empty list and an edit error', async () => {
    // Given
    const user = userEvent.setup();
    const initialProps = createRepositorySelectionProps({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });
    const { rerender } = render(<RepositorySelection {...initialProps} />);

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    // Simulate re-render from hook state update after a failed/partial delete.
    rerender(
      <RepositorySelection
        {...initialProps}
        editError="Failed to delete repository."
        repositories={{
          invalidRepositories: [],
          repositories: [],
        }}
      />,
    );

    // Then
    expect(screen.getByRole('button', { name: 'Done' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toBeDefined();
  });

  it('disables edit actions including Cancel while saving', async () => {
    // Given
    const user = userEvent.setup();
    const initialProps = createRepositorySelectionProps({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'other-repo', name: 'other-repo', path: '/repo/other-repo' },
      ],
    });
    const { rerender } = render(<RepositorySelection {...initialProps} />);

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    rerender(<RepositorySelection {...initialProps} saving={true} />);

    // Then
    expect(screen.getByRole('button', { name: 'Remove sift' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Remove other-repo' })).toHaveProperty(
      'disabled',
      true,
    );
    // Done is relabeled "Saving..." while a commit is in flight to give the
    // user feedback during the (potentially multi-request) deletion sequence.
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Saving...' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel edit' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Add Repository' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveProperty('disabled', true);
  });
});
