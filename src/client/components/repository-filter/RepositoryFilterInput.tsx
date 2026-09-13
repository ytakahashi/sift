import { useEffect, useRef, type ReactElement } from 'react';
import { Search, X } from 'lucide-react';

export interface RepositoryFilterInputProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Enables the document-level `/` shortcut that focuses this input.
   * Only one mounted filter input should enable the shortcut at a time.
   */
  shortcutEnabled: boolean;
  /** Additional class for layout differences between hosts. */
  className?: string;
}

function isEditableElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.matches('input, textarea, select') || target.isContentEditable)
  );
}

export function RepositoryFilterInput({
  className,
  onChange,
  shortcutEnabled,
  value,
}: RepositoryFilterInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcutEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      // Preserve slash input in the filter itself and other editable controls.
      if (
        event.key !== '/' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableElement(event.target)
      ) {
        return;
      }

      const input = inputRef.current;
      if (!input) {
        return;
      }

      event.preventDefault();
      input.focus();
      input.select();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcutEnabled]);

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
