import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "info" | "success" | "error";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

export interface ToastOptions {
  kind?: ToastKind;
  action?: ToastAction;
  /** Auto-dismiss delay in ms; 0 keeps it until dismissed. Defaults by kind. */
  timeout?: number;
}

interface ToastApi {
  toasts: Toast[];
  notify: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi>({
  toasts: [],
  notify: () => 0,
  dismiss: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      const kind = options.kind ?? "info";
      setToasts((prev) => [...prev, { id, message, kind, action: options.action }]);
      const timeout = options.timeout ?? (kind === "error" ? 8000 : 5000);
      if (timeout > 0) {
        setTimeout(() => dismiss(id), timeout);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastApi>(() => ({ toasts, notify, dismiss }), [toasts, notify, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastApi {
  return useContext(ToastContext);
}
