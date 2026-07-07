import { wordCountPlugin } from "./word-count";
import type { NotesPlugin } from "@notes/plugin-host";

/**
 * Locally bundled plugins. In MVP these are trusted, in-process modules; the
 * `.notes/plugins/` discovery path (loading plugin folders from the Tome) is
 * future work — see docs/plugins.md.
 */
export const localPlugins: NotesPlugin[] = [wordCountPlugin];
