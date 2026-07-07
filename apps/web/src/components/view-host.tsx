import { NoteEditor } from "./note-editor";

/** Routes a note to its editor. NoteEditor picks the right view by type. */
export function ViewHost({ path }: { path: string }) {
  return <NoteEditor path={path} />;
}
