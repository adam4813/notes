import { useCallback, useEffect, useRef, useState } from "react";

export interface PromptField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  type?: "text" | "url";
}

export interface PromptRequest {
  title: string;
  description?: string;
  fields: PromptField[];
  confirmLabel?: string;
  cancelLabel?: string;
}

type PromptValues = Record<string, string>;

interface PromptState {
  request: PromptRequest;
  values: PromptValues;
  error: string | null;
}

export function usePromptDialog() {
  const [state, setState] = useState<PromptState | null>(null);
  const resolverRef = useRef<((result: PromptValues | null) => void) | null>(null);

  const closePrompt = useCallback((result: PromptValues | null) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setState(null);
    resolver?.(result);
  }, []);

  useEffect(
    () => () => {
      if (resolverRef.current) {
        resolverRef.current(null);
        resolverRef.current = null;
      }
    },
    [],
  );

  const openPrompt = useCallback((request: PromptRequest) => {
    return new Promise<PromptValues | null>((resolve) => {
      if (resolverRef.current) {
        resolverRef.current(null);
      }
      resolverRef.current = resolve;
      const values = Object.fromEntries(
        request.fields.map((field) => [field.key, field.defaultValue ?? ""]),
      );
      setState({ request, values, error: null });
    });
  }, []);

  const promptDialog = state ? (
    <div className="modal-overlay" onMouseDown={() => closePrompt(null)}>
      <div className="modal prompt-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{state.request.title}</h2>
          <button
            type="button"
            className="btn-ghost"
            aria-label="Close prompt"
            onClick={() => closePrompt(null)}
          >
            ×
          </button>
        </div>
        {state.request.description && (
          <p className="prompt-dialog-description">{state.request.description}</p>
        )}
        <form
          className="prompt-dialog-body"
          onSubmit={(event) => {
            event.preventDefault();
            const missing = state.request.fields.find(
              (field) => field.required && !(state.values[field.key] ?? "").trim(),
            );
            if (missing) {
              setState((prev) =>
                prev
                  ? {
                      ...prev,
                      error: `${missing.label} is required.`,
                    }
                  : prev,
              );
              return;
            }
            closePrompt(state.values);
          }}
        >
          {state.request.fields.map((field, index) => (
            <label key={field.key} className="prompt-dialog-field">
              <span>{field.label}</span>
              <input
                type={field.type ?? "text"}
                autoFocus={index === 0}
                value={state.values[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setState((prev) =>
                    prev
                      ? {
                          ...prev,
                          values: { ...prev.values, [field.key]: event.target.value },
                          error: null,
                        }
                      : prev,
                  )
                }
              />
            </label>
          ))}
          {state.error && <p className="prompt-dialog-error">{state.error}</p>}
          <div className="prompt-dialog-actions">
            <button type="button" className="btn-ghost" onClick={() => closePrompt(null)}>
              {state.request.cancelLabel ?? "Cancel"}
            </button>
            <button type="submit" className="tb-link-ok">
              {state.request.confirmLabel ?? "OK"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return { openPrompt, promptDialog };
}
