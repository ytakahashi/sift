import { cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('filters repositories by name without distinguishing case and updates the count', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'Sift', path: '/repo/sift' },
        { id: 'website', name: 'Website', path: '/repo/website' },
      ],
    });

    // When
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'SIFT');

    // Then
    expect(screen.getByRole('button', { name: 'Sift/repo/sift' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Website/repo/website' })).toBeNull();
    expect(screen.getByText('1 of 2 shown')).toBeDefined();
  });

  it('filters repositories by a substring in the path', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'first-repo', name: 'First', path: '/work/github/sift' },
        { id: 'second-repo', name: 'Second', path: '/work/gitlab/other' },
      ],
    });

    // When
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'GITHUB/SIFT');

    // Then
    expect(screen.getByRole('button', { name: 'First/work/github/sift' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Second/work/gitlab/other' })).toBeNull();
  });

  it('filters invalid repositories by name and path but not by reason', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [
        {
          id: 'missing-repo',
          name: 'missing-repo',
          path: '/work/legacy/missing-repo',
          reason: 'Permission denied',
        },
      ],
      repositories: [{ id: 'sift', name: 'sift', path: '/work/sift' }],
    });
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });

    // When
    await user.type(filterInput, 'legacy');

    // Then
    expect(screen.getByText('missing-repo')).toBeDefined();
    expect(screen.getByText('Permission denied')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'sift/work/sift' })).toBeNull();

    // When
    await user.clear(filterInput);
    await user.type(filterInput, 'permission');

    // Then
    expect(screen.queryByText('missing-repo')).toBeNull();
    expect(screen.getByText('No repositories match "permission".')).toBeDefined();
  });

  it('distinguishes no filter matches from an unconfigured list and can clear the filter', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });

    // When
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'missing');

    // Then
    expect(screen.getByText('No repositories match "missing".')).toBeDefined();
    expect(screen.queryByText('No repositories available.')).toBeNull();

    // When
    await user.click(screen.getByText('Clear repository filter'));

    // Then
    expect(screen.getByRole('button', { name: 'sift/repo/sift' })).toBeDefined();
    expect(screen.getByText('1 configured')).toBeDefined();
  });

  it('clears the repository filter with the search field clear button', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'website', name: 'website', path: '/repo/website' },
      ],
    });
    const search = screen.getByRole('search', { name: 'Repository filter' });
    await user.type(within(search).getByRole('textbox', { name: 'Filter repositories' }), 'sift');

    // When
    await user.click(within(search).getByRole('button', { name: 'Clear repository filter' }));

    // Then
    expect(screen.getByRole('button', { name: 'website/repo/website' })).toBeDefined();
    expect(within(search).queryByRole('button', { name: 'Clear repository filter' })).toBeNull();
  });

  it('clears the repository filter with Escape', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'website', name: 'website', path: '/repo/website' },
      ],
    });
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });
    await user.type(filterInput, 'sift');

    // When
    await user.type(filterInput, '{Escape}');

    // Then
    expect(filterInput).toHaveProperty('value', '');
    expect(screen.getByRole('button', { name: 'website/repo/website' })).toBeDefined();
  });

  it('does not clear the repository filter with Escape during IME composition', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'sift', name: 'sift', path: '/repo/sift' },
        { id: 'website', name: 'website', path: '/repo/website' },
      ],
    });
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });
    await user.type(filterInput, 'sif');

    // When
    fireEvent.keyDown(filterInput, { isComposing: true, key: 'Escape' });

    // Then
    expect(filterInput).toHaveProperty('value', 'sif');
    expect(screen.queryByRole('button', { name: 'website/repo/website' })).toBeNull();
  });

  it('does not show the repository filter for an unconfigured list', () => {
    // Given / When
    renderRepositorySelection({ invalidRepositories: [], repositories: [] });

    // Then
    expect(screen.queryByRole('textbox', { name: 'Filter repositories' })).toBeNull();
    expect(screen.getByText('No repositories available.')).toBeDefined();
  });

  it('shows the unconfigured state when a filtered repository list becomes empty', async () => {
    // Given
    const user = userEvent.setup();
    const initialProps = createRepositorySelectionProps({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });
    const { rerender } = render(<RepositorySelection {...initialProps} />);
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'website');

    // When
    rerender(
      <RepositorySelection
        {...initialProps}
        repositories={{ invalidRepositories: [], repositories: [] }}
      />,
    );

    // Then
    expect(screen.getByText('No repositories available.')).toBeDefined();
    expect(screen.queryByText('No repositories match "website".')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Filter repositories' })).toBeNull();
  });

  it('selects the repository filter text when slash is pressed outside an editable control', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'Sift', path: '/repo/sift' }],
    });
    const filterInput = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Filter repositories',
    });
    await user.type(filterInput, 'sift');
    filterInput.blur();
    const shortcutEvent = createEvent.keyDown(document, { cancelable: true, key: '/' });

    // When
    fireEvent(document, shortcutEvent);

    // Then
    expect(document.activeElement).toBe(filterInput);
    expect(filterInput.selectionStart).toBe(0);
    expect(filterInput.selectionEnd).toBe(4);
    expect(shortcutEvent.defaultPrevented).toBe(true);
  });

  it('preserves slash input in the repository path field', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'Sift', path: '/repo/sift' }],
    });
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));
    const pathInput = screen.getByRole('textbox', { name: 'Repository path' });

    // When
    await user.type(pathInput, '/repo/other');

    // Then
    expect(document.activeElement).toBe(pathInput);
    expect(pathInput).toHaveProperty('value', '/repo/other');
  });

  it('does not activate the repository filter shortcut while the add form is open', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'Sift', path: '/repo/sift' }],
    });
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));
    const shortcutEvent = createEvent.keyDown(document, { cancelable: true, key: '/' });

    // When
    fireEvent(document, shortcutEvent);

    // Then
    expect(document.activeElement).not.toBe(filterInput);
    expect(shortcutEvent.defaultPrevented).toBe(false);
  });

  it('does not focus the repository filter for modified slash shortcuts', () => {
    // Given
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'Sift', path: '/repo/sift' }],
    });
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });
    const ctrlShortcutEvent = createEvent.keyDown(document, {
      cancelable: true,
      ctrlKey: true,
      key: '/',
    });
    const metaShortcutEvent = createEvent.keyDown(document, {
      cancelable: true,
      key: '/',
      metaKey: true,
    });
    const altShortcutEvent = createEvent.keyDown(document, {
      altKey: true,
      cancelable: true,
      key: '/',
    });

    // When
    fireEvent(document, ctrlShortcutEvent);
    fireEvent(document, metaShortcutEvent);
    fireEvent(document, altShortcutEvent);

    // Then
    expect(document.activeElement).not.toBe(filterInput);
    expect(ctrlShortcutEvent.defaultPrevented).toBe(false);
    expect(metaShortcutEvent.defaultPrevented).toBe(false);
    expect(altShortcutEvent.defaultPrevented).toBe(false);
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

  it('clears the repository filter after adding a repository succeeds', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });
    await user.type(filterInput, 'website');
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));
    await user.type(screen.getByRole('textbox', { name: 'Repository path' }), '/repo/website');

    // When
    await user.click(screen.getByRole('button', { name: 'OK' }));

    // Then
    expect(filterInput).toHaveProperty('value', '');
    expect(screen.getByRole('button', { name: 'sift/repo/sift' })).toBeDefined();
  });

  it('keeps the repository filter when adding a repository fails', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection(
      {
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      },
      { onAddRepository: vi.fn().mockResolvedValue(false) },
    );
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });
    await user.type(filterInput, 'website');
    await user.click(screen.getByRole('button', { name: 'Add Repository' }));
    await user.type(screen.getByRole('textbox', { name: 'Repository path' }), '/repo/website');

    // When
    await user.click(screen.getByRole('button', { name: 'OK' }));

    // Then
    expect(filterInput).toHaveProperty('value', 'website');
    expect(screen.getByRole('textbox', { name: 'Repository path' })).toBeDefined();
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

  it('disables drag handles while filtering in edit mode', async () => {
    // Given
    const user = userEvent.setup();
    renderRepositorySelection({
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
    });
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'sift');

    // When
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));

    // Then
    expect(screen.getByRole('button', { name: 'Drag sift' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('listitem')).toHaveProperty('draggable', false);
  });

  it('does not reorder repositories when drag events are dispatched while filtering', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [],
      repositories: [
        { id: 'first-repo', name: 'first-repo', path: '/repo/first' },
        { id: 'second-repo', name: 'second-repo', path: '/repo/second' },
      ],
    });
    await user.type(screen.getByRole('textbox', { name: 'Filter repositories' }), 'repo');
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    const dataTransfer = createDataTransfer();
    dataTransfer.setData('text/plain', 'second-repo');

    // When
    fireEvent.dragStart(screen.getAllByRole('listitem')[1], { dataTransfer });
    fireEvent.dragOver(screen.getAllByRole('listitem')[0], { dataTransfer });
    fireEvent.drop(screen.getAllByRole('listitem')[0], { dataTransfer });
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onCommitRepositoryListEdits).not.toHaveBeenCalled();
  });

  it('keeps pending resolved and invalid deletes visible across filter changes', async () => {
    // Given
    const user = userEvent.setup();
    const { onCommitRepositoryListEdits } = renderRepositorySelection({
      invalidRepositories: [
        { id: 'missing-repo', name: 'missing-repo', path: '/repo/missing', reason: 'Missing' },
      ],
      repositories: [{ id: 'sift-repo', name: 'sift-repo', path: '/repo/sift' }],
    });
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });
    await user.type(filterInput, 'repo');
    await user.click(screen.getByRole('button', { name: 'Edit Repository List' }));
    await user.click(screen.getByRole('button', { name: 'Remove sift-repo' }));
    await user.click(screen.getByRole('button', { name: 'Remove missing-repo' }));

    // When
    await user.clear(filterInput);
    await user.type(filterInput, 'website');

    // Then
    expect(screen.getByRole('button', { name: 'Undo remove sift-repo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Undo remove missing-repo' })).toBeDefined();
    expect(screen.getByText('2 of 2 shown')).toBeDefined();

    // When
    await user.click(screen.getByRole('button', { name: 'Done' }));

    // Then
    expect(onCommitRepositoryListEdits).toHaveBeenCalledWith(['sift-repo', 'missing-repo'], []);
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
