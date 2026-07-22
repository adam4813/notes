import type { CommandBus, EventBus } from "@notes/core";
import type {
  FileBinaryPayload,
  FileMovePayload,
  FilePathPayload,
  FileWritePayload,
} from "@notes/shared";
import type { Tome } from "@notes/tome";
import { rewriteEmbeddedReferences } from "../rename-references";
import { emitNotePathMoved, type NoteLifecycleEventMap } from "./note-lifecycle";

/** Registers the core `file.*` commands, backed by the active Tome. */
export function registerFileCommands(
  bus: CommandBus,
  getTome: () => Tome,
  events: EventBus<NoteLifecycleEventMap>,
): void {
  bus.register({
    name: "file.tree",
    handler: async () => ({ entries: await getTome().listTree() }),
  });

  bus.register<FilePathPayload, { path: string; content: string }>({
    name: "file.read",
    handler: async (payload) => ({
      path: payload.path,
      content: await getTome().read(payload.path),
    }),
  });

  bus.register<FilePathPayload, { path: string; contentBase64: string }>({
    name: "file.readBinary",
    handler: async (payload) => ({
      path: payload.path,
      contentBase64: Buffer.from(await getTome().readBinary(payload.path)).toString("base64"),
    }),
  });

  bus.register<FileWritePayload, { path: string }>({
    name: "file.write",
    handler: async (payload) => {
      await getTome().write(payload.path, payload.content);
      return { path: payload.path };
    },
  });

  bus.register<FileWritePayload, { path: string }>({
    name: "file.create",
    handler: async (payload) => {
      await getTome().create(payload.path, payload.content);
      return { path: payload.path };
    },
  });

  bus.register<FileBinaryPayload, { path: string }>({
    name: "file.createBinary",
    handler: async (payload) => {
      await getTome().createBinary(payload.path, Buffer.from(payload.contentBase64, "base64"));
      return { path: payload.path };
    },
  });

  for (const name of ["file.rename", "file.move"] as const) {
    bus.register<FileMovePayload, FileMovePayload>({
      name,
      handler: async (payload, ctx) => {
        const tome = getTome();
        const noteTypeResult = (await bus.dispatch(
          "note.detectType",
          { path: payload.from },
          ctx,
        )) as { type: string | null };
        await tome.move(payload.from, payload.to);
        await emitNotePathMoved(events, {
          fromPath: payload.from,
          toPath: payload.to,
          noteType: noteTypeResult.type,
        });
        const entries = await tome.listTree({ includeDotfiles: true });
        const stack = [...entries];
        while (stack.length > 0) {
          const entry = stack.pop();
          if (!entry) {
            continue;
          }
          if (entry.type === "directory") {
            stack.push(...(entry.children ?? []));
            continue;
          }
          if (
            !entry.path.toLowerCase().endsWith(".md") &&
            !entry.path.toLowerCase().endsWith(".canvas")
          ) {
            continue;
          }
          const content = await tome.read(entry.path);
          const updated = rewriteEmbeddedReferences(entry.path, content, payload.from, payload.to);
          if (updated !== content) {
            await tome.write(entry.path, updated);
          }
        }
        return payload;
      },
    });
  }

  bus.register<FilePathPayload, { path: string }>({
    name: "file.mkdir",
    handler: async (payload) => {
      await getTome().mkdir(payload.path);
      return { path: payload.path };
    },
  });

  bus.register<FilePathPayload, { path: string }>({
    name: "file.delete",
    handler: async (payload) => {
      await getTome().delete(payload.path);
      return { path: payload.path };
    },
  });

  bus.register<FilePathPayload, { path: string; exists: boolean }>({
    name: "file.exists",
    handler: async (payload) => ({
      path: payload.path,
      exists: await getTome().exists(payload.path),
    }),
  });
}
