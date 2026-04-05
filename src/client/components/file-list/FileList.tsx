import type { DiffFile } from '../../../domain/diff/types';

interface FileListProps {
  files: DiffFile[];
  selectedFileId: string | null;
  onSelect: (file: DiffFile) => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'modified': return '#d2a8ff'; // purple
    case 'added': return '#3fb950';    // green
    case 'deleted': return '#f85149';  // red
    case 'renamed': return '#a5d6ff';  // light blue
    default: return '#8b949e';         // gray
  }
}

export function FileList({ files, selectedFileId, onSelect }: FileListProps) {
  if (files.length === 0) {
    return <div className="empty-state" style={{ color: '#8b949e' }}>No changes</div>;
  }

  return (
    <div className="file-list">
      {files.map(file => {
        const isSelected = selectedFileId === file.id;
        return (
          <div
            key={file.id}
            className={`file-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(file)}
            style={{
              padding: '0.4rem 0.5rem',
              cursor: 'pointer',
              backgroundColor: isSelected ? 'rgba(88, 166, 255, 0.15)' : 'transparent',
              borderLeft: isSelected ? '3px solid #58a6ff' : '3px solid transparent',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                flex: 1
              }}
              title={file.oldPath ? `${file.oldPath} -> ${file.path}` : file.path}
            >
              {file.oldPath ? <span><span style={{opacity: 0.6}}>{file.oldPath}</span> &rarr; {file.path}</span> : file.path}
            </span>
            <span
              className="status-badge"
              style={{
                fontSize: '0.75rem',
                color: getStatusColor(file.status),
                marginLeft: '0.5rem',
                fontWeight: 600
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
