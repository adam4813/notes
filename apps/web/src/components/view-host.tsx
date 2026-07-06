import { NoteEditor } from "./note-editor";
import { PlaceholderView } from "../views/placeholder-view";

/** Routes a note to the correct view based on its type (extension for MVP). */
export function ViewHost({ path }: { path: string }) {
  if (path.toLowerCase().endsWith(".canvas")) {
    return <PlaceholderView kind="Canvas" note="The canvas note type arrives in Phase 7." />;
  }
  return <NoteEditor path={path} />;
}
