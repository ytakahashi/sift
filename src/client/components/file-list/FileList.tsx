import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import { resolveAbsoluteFilePath } from '../../presentation/file-list/file-path';
import { FilePathLabel } from './FilePathLabel';
import { FilePathContextMenu } from './FilePathContextMenu';
import { useFileListController } from './useFileListController';

interface FileListProps {
  files: DiffFile[];
  repoRoot: string | null;
  selectedFileId: string | null;
  onSelect: (file: DiffFile) => void;
  onActivate: (file: DiffFile) => void;
  disabled?: boolean;
  isActive?: boolean;
  onBoundaryNavigate?: (direction: 'previous' | 'next') => void;
}

interface FilePathContextMenuState {
  clientX: number;
  clientY: number;
  file: DiffFile;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'modified':
      return '#d2a8ff'; // purple
    case 'added':
      return '#3fb950'; // green
    case 'deleted':
      return '#f85149'; // red
    case 'renamed':
      return '#a5d6ff'; // light blue
    default:
      return '#8b949e'; // gray
  }
}

export function FileList({
  files,
  repoRoot,
  selectedFileId,
  onSelect,
  onActivate,
  disabled = false,
  isActive = false,
  onBoundaryNavigate,
}: FileListProps): ReactElement {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<FilePathContextMenuState | null>(null);
  const closeContextMenu = useCallback((): void => {
    setContextMenu(null);
  }, []);
  const { onKeyDown } = useFileListController({
    files,
    selectedFileId,
    disabled,
    onSelect,
    onActivate,
    onBoundaryNavigate,
  });

  useEffect(() => {
    if (isActive && selectedFileId) {
      // Focus the list unconditionally so that keyboard boundary navigation
      // (ArrowDown past the last item) correctly transfers focus to the newly
      // active pane. Guarding with list.contains(document.activeElement) would
      // prevent that transfer while only marginally improving the rare case
      // where a server refresh changes selectedFileId while focus is elsewhere.
      listRef.current?.focus();
    }
  }, [isActive, selectedFileId]);

  if (files.length === 0) {
    return (
      <div className="empty-state" style={{ color: '#8b949e' }}>
        No changes
      </div>
    );
  }

  return (
    <div
      className="file-list"
      role="listbox"
      aria-label="Changed files"
      aria-activedescendant={selectedFileId ? `file-item-${selectedFileId}` : undefined}
      tabIndex={0}
      ref={listRef}
      onKeyDown={onKeyDown}
    >
      {files.map((file) => {
        const isSelected = selectedFileId === file.id;
        const fullPathLabel = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;
        const statusLabel = file.status.charAt(0).toUpperCase();
        return (
          <div
            aria-label={`${fullPathLabel}${statusLabel}`}
            key={file.id}
            id={`file-item-${file.id}`}
            className={`file-item ${isSelected ? 'selected' : ''}`}
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              // Move keyboard focus to the listbox so that Arrow / Enter keys
              // work immediately after a mouse click without a second interaction.
              listRef.current?.focus();
              onSelect(file);
            }}
            onDoubleClick={() => {
              listRef.current?.focus();
              // Skip activation while an action is in flight to prevent
              // double-submission during the optimistic update window.
              if (!disabled) {
                onActivate(file);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onSelect(file);
              setContextMenu({
                clientX: event.clientX,
                clientY: event.clientY,
                file,
              });
            }}
            style={{
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.7 : 1,
            }}
          >
            <FilePathLabel oldPath={file.oldPath} path={file.path} />
            <span
              className="status-badge"
              style={{
                fontSize: '0.75rem',
                color: getStatusColor(file.status),
                marginLeft: '0.5rem',
                fontWeight: 600,
              }}
            >
              {statusLabel}
            </span>
          </div>
        );
      })}
      {contextMenu && (
        <FilePathContextMenu
          absolutePath={repoRoot ? resolveAbsoluteFilePath(repoRoot, contextMenu.file.path) : null}
          clientX={contextMenu.clientX}
          clientY={contextMenu.clientY}
          onClose={closeContextMenu}
          relativePath={contextMenu.file.path}
        />
      )}
    </div>
  );
}
