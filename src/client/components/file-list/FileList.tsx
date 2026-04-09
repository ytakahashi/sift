import { useEffect, useRef } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import { useFileListController } from './useFileListController';

interface FileListProps {
  files: DiffFile[];
  selectedFileId: string | null;
  onSelect: (file: DiffFile) => void;
  onActivate: (file: DiffFile) => void;
  disabled?: boolean;
  isActive?: boolean;
  onBoundaryNavigate?: (direction: 'previous' | 'next') => void;
}

function getStatusColor(status: string) {
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
  selectedFileId,
  onSelect,
  onActivate,
  disabled = false,
  isActive = false,
  onBoundaryNavigate,
}: FileListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
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
        return (
          <div
            key={file.id}
            id={`file-item-${file.id}`}
            className={`file-item ${isSelected ? 'selected' : ''}`}
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              listRef.current?.focus();
              onSelect(file);
            }}
            onDoubleClick={() => {
              listRef.current?.focus();
              if (!disabled) {
                onActivate(file);
              }
            }}
            style={{
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.7 : 1,
            }}
          >
            <span
              style={{
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              title={file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path}
            >
              {file.oldPath ? (
                <span>
                  <span style={{ opacity: 0.6 }}>{file.oldPath}</span> &rarr; {file.path}
                </span>
              ) : (
                file.path
              )}
            </span>
            <span
              className="status-badge"
              style={{
                fontSize: '0.75rem',
                color: getStatusColor(file.status),
                marginLeft: '0.5rem',
                fontWeight: 600,
              }}
            >
              {file.status.charAt(0).toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
