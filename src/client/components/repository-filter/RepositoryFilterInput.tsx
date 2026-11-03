import type { ReactElement, Ref } from 'react';
import { Search, X } from 'lucide-react';

export interface RepositoryFilterInputProps {
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  /** Additional class for layout differences between hosts. */
  className?: string;
}

export type RepositoryFilterHostProps = Omit<RepositoryFilterInputProps, 'inputRef'> & {
  /** Only one mounted filter may enable the document shortcut at a time. */
  shortcutEnabled: boolean;
};

/** Hosts supply local availability; pages compose the keyboard behavior. */
export type RepositoryFilterRenderer = (props: RepositoryFilterHostProps) => ReactElement;

export function RepositoryFilterInput({
  className,
  onChange,
  inputRef,
  value,
}: RepositoryFilterInputProps): ReactElement {
  return (
    <div
      aria-label="Repository filter"
      className={className ? `repository-filter ${className}` : 'repository-filter'}
      role="search"
    >
      <Search aria-hidden="true" className="repository-filter-icon" size={16} />
      <input
        aria-label="Filter repositories"
        className="repository-filter-input"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Escape during IME composition cancels the conversion, not the filter.
          if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
            onChange('');
          }
        }}
        placeholder="Filter repositories"
        ref={inputRef}
        type="text"
        value={value}
      />
      {value.length > 0 && (
        <button
          aria-label="Clear repository filter"
          className="repository-filter-clear"
          onClick={() => onChange('')}
          type="button"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
