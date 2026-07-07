import type { CommandBus } from "@notes/core";
import type { FileMovePayload, FilePathPayload, FileWritePayload } from "@notes/shared";
import type { Tome } from "@notes/tome";

/** Registers the core `file.*` commands, backed by the active Tome. */
export function registerFileCommands(bus: CommandBus, getTome: () => Tome): void {
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

  for (const name of ["file.rename", "file.move"] as const) {
    bus.register<FileMovePayload, FileMovePayload>({
      name,
      handler: async (payload) => {
        await getTome().move(payload.from, payload.to);
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
}
