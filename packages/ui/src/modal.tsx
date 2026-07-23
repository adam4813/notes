import { type ReactNode, useEffect } from "react";

interface ModalProps {
  /** Whether the modal is visible. When false, nothing is rendered. */
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  /** CSS width override, e.g. "600px". Defaults to min(720px, 90vw) via CSS. */
  width?: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Modal overlay + dialog shell. Closes on Escape or overlay click.
 * Compose with `ModalHeader`, `ModalBody`, and `ModalFooter`.
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
}: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={["modal", className].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
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
