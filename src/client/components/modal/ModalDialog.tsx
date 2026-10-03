import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';

interface ModalDialogProps {
  titleId: string;
  initialFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  panelStyle?: CSSProperties;
  backdropTestId?: string;
}

/**
 * Disabled controls are excluded because the browser skips them when tabbing.
 * Treating one as the last element would let Tab escape behind the dialog.
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps focus, closes on Escape or backdrop click, and restores focus to the
 * element that was active before the dialog opened.
 *
 * initialFocusRef must point to an element inside the panel and remain the same
 * ref object across renders (as with useRef). A new ref on each render reruns
 * the focus effect, pulling focus back to the initial element on every render.
 * Keep onClose stable when possible to avoid replacing the keydown listener
 * on every render.
 */
export function ModalDialog({
  titleId,
  initialFocusRef,
  onClose,
  children,
  panelStyle,
  backdropTestId,
}: ModalDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    initialFocusRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, [initialFocusRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        data-testid={backdropTestId}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 199,
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '6px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200,
          ...panelStyle,
        }}
      >
        {children}
      </div>
    </>
  );
}
