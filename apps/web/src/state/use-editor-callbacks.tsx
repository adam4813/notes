import type { EditorCallbacks } from "@notes/editor";
import { useMemo } from "react";
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

/**
 * Builds the EditorCallbacks object for the active Tome context.
 * Centralises wikilink navigation, tag/note listing, file imports, and embed
 * rendering so any component that needs them can call this hook instead of
 * inlining the same useMemo.
 */
export function useEditorCallbacks(isStandalone: boolean): EditorCallbacks {
  const { dispatch } = useWorkspace();
  const { settings } = useAppServices();
  const { notify } = useToasts();

  return useMemo<EditorCallbacks>(
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
    }),
    [dispatch, notify, settings.mediaDirectory, isStandalone],
  );
}
