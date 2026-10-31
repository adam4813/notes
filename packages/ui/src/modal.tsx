import { type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  /** Whether the modal is visible. When false, nothing is rendered. */
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** CSS width override, e.g. "600px". Defaults to min(720px, 90vw) via CSS. */
  width?: string;
  className?: string;
  ariaLabel?: string;
  /**
   * Scope the modal to its nearest positioned ancestor (e.g. a note editor
   * tab's region) instead of covering the whole viewport. In this mode the
   * overlay background does not close the modal, and Escape only closes it
   * while focus is within the scoped area — so other tabs stay interactive and
   * notes can be dragged onto the modal.
   */
  contained?: boolean;
}

/**
 * Modal overlay + dialog shell. Closes on Escape, and on overlay click unless
 * `contained`. Compose with `ModalHeader`, `ModalBody`, and `ModalFooter`.
 *
 * @example
 * ```tsx
 * <Modal open={isOpen} onClose={close} ariaLabel="Edit item">
 *   <ModalHeader onClose={close}>
 *     <h2>Title</h2>
 *   </ModalHeader>
 *   <ModalBody>
 *     <p>Content</p>
 *   </ModalBody>
 *   <ModalFooter>
 *     <button onClick={close}>Done</button>
 *   </ModalFooter>
 * </Modal>
 * ```
 */
export function Modal({
  open = true,
  onClose,
  children,
  width,
  className,
  ariaLabel = "Dialog",
  contained = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (contained) {
        // Only close when the scoped area (this tab's editor region) holds
        // focus, so Escape in another tab doesn't dismiss this modal.
        const scope = overlayRef.current?.offsetParent ?? overlayRef.current?.parentElement;
        if (!scope || !scope.contains(document.activeElement)) return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, contained]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={["modal-overlay", contained && "modal-overlay--contained"]
        .filter(Boolean)
        .join(" ")}
      onClick={contained ? undefined : onClose}
    >
      <div
        className={["modal", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal={!contained}
        aria-label={ariaLabel}
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface SlotProps {
  children: ReactNode;
  className?: string;
}

/** Header bar inside a Modal. Pass `onClose` to render the built-in ✕ button. */
export function ModalHeader({
  children,
  className,
  onClose,
}: SlotProps & { onClose?: () => void }) {
  return (
    <div className={["modal-header", className].filter(Boolean).join(" ")}>
      <div className="modal-header-content">{children}</div>
      {onClose && (
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      )}
    </div>
  );
}

/** Scrollable body area inside a Modal. */
export function ModalBody({ children, className }: SlotProps) {
  return <div className={["modal-body", className].filter(Boolean).join(" ")}>{children}</div>;
}

/** Footer area inside a Modal (e.g. action buttons). */
export function ModalFooter({ children, className }: SlotProps) {
  return <div className={["modal-footer", className].filter(Boolean).join(" ")}>{children}</div>;
}
