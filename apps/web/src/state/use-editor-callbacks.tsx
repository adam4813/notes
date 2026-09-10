import type { EditorCallbacks } from "@notes/editor";
import { usePromptDialog } from "@notes/editor";
import { useMemo, type ReactNode } from "react";
import { api } from "../api/client";
import { EmbedWidget } from "../components/embed-widget";
import {
  importedFilePath,
  markdownForImportedFile,
  normalizeMediaDirectory,
  toBase64,
} from "../lib/images";
import { useWorkspace } from "./app-context";
import { useAppServices } from "./app-services";
import { useToasts } from "./toast";

function basename(path: string): string {
  return (path.split("/").pop() ?? path).replace(/\.[^.]+$/, "");
}

export interface EditorCallbacksResult {
  callbacks: EditorCallbacks;
  promptDialog: ReactNode;
}

/**
 * Builds the EditorCallbacks object for the active Tome context.
 * Centralises wikilink navigation, tag/note listing, file imports, and embed
 * rendering so any component that needs them can call this hook instead of
 * inlining the same useMemo.
 *
 * Also returns a `promptDialog` ReactNode that must be rendered in the
 * consuming component to support the `extractToNewNote` callback.
 */
export function useEditorCallbacks(isStandalone: boolean): EditorCallbacksResult {
  const { dispatch } = useWorkspace();
  const { settings } = useAppServices();
  const { notify } = useToasts();
  const { openPrompt, promptDialog } = usePromptDialog();

  const callbacks = useMemo<EditorCallbacks>(
    () => ({
      onOpenWikilink: (name) => {
        void (async () => {
          const resolved = await api.resolve(name);
          if (resolved.path) {
            dispatch({ type: "openFile", path: resolved.path, title: name });
            return;
          }
          const newPath = `${name}.md`;
          await api.create(newPath, `# ${name}\n\n`).catch(() => undefined);
          dispatch({ type: "openFile", path: newPath, title: name });
        })();
      },
      onOpenFile: (path) => dispatch({ type: "openFile", path, title: basename(path) }),
      listNotes: async () => (await api.notes()).notes,
      listTags: async () => (await api.tags()).tags.map((tag) => tag.tag),
      onImportFile: isStandalone
        ? undefined
        : async (file) => {
            const mediaPath = importedFilePath(
              file,
              normalizeMediaDirectory(settings.mediaDirectory),
            );
            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              await api.createBinary(mediaPath, toBase64(bytes));
              notify(`Imported file saved to ${mediaPath}`, { kind: "success" });
              return markdownForImportedFile(mediaPath, file.type, api.fileRawUrl(mediaPath));
            } catch {
              notify("Couldn't import dropped file", { kind: "error" });
              return null;
            }
          },
      renderEmbed: (embedTarget) => <EmbedWidget target={embedTarget} />,
      disableFileDrop: isStandalone,
      extractToNewNote: isStandalone
        ? undefined
        : async (content, mode) => {
            const result = await openPrompt({
              title: mode === "copy" ? "Copy to New Note" : "Move to New Note",
              description:
                mode === "copy"
                  ? "Create a new note containing the selected text."
                  : "Move the selected text to a new note and replace it with a wikilink.",
              fields: [
                {
                  key: "name",
                  label: "Note name",
                  placeholder: "Enter note name",
                  required: true,
                  defaultValue: "",
                },
              ],
              confirmLabel: mode === "copy" ? "Copy" : "Move",
            });
            if (!result) return null;
            const name = result["name"].trim();
            if (!name) return null;
            const path = name.toLowerCase().endsWith(".md") ? name : `${name}.md`;
            const noteName = path.replace(/\.md$/i, "").split("/").pop() ?? name;
            try {
              await api.create(path, `# ${noteName}\n\n${content}\n`);
              dispatch({ type: "openFile", path, title: noteName });
              return path;
            } catch {
              notify(`Couldn't create note "${noteName}"`, { kind: "error" });
              return null;
            }
          },
    }),
    [dispatch, notify, settings.mediaDirectory, isStandalone, openPrompt],
  );

  return { callbacks, promptDialog };
}
