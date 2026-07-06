import { z } from "zod";

/** Zod schemas for command payloads, used by the server validation middleware. */

export const filePathPayload = z.object({ path: z.string().min(1) });
export const fileWritePayload = z.object({ path: z.string().min(1), content: z.string().default("") });
export const fileMovePayload = z.object({ from: z.string().min(1), to: z.string().min(1) });
export const emptyPayload = z.object({}).passthrough();

export const searchPayload = z.object({
  query: z.string(),
  limit: z.number().int().positive().max(200).optional(),
});
export const tagPayload = z.object({ tag: z.string().min(1) });
export const resolvePayload = z.object({ text: z.string().min(1) });

export type FilePathPayload = z.infer<typeof filePathPayload>;
export type FileWritePayload = z.infer<typeof fileWritePayload>;
export type FileMovePayload = z.infer<typeof fileMovePayload>;

/** Map of command name → payload schema. Commands without an entry skip validation. */
export const commandSchemas: Record<string, z.ZodTypeAny> = {
  "file.tree": emptyPayload,
  "file.read": filePathPayload,
  "file.write": fileWritePayload,
  "file.create": fileWritePayload,
  "file.rename": fileMovePayload,
  "file.move": fileMovePayload,
  "file.delete": filePathPayload,
  "index.search": searchPayload,
  "index.backlinks": filePathPayload,
  "index.outgoing": filePathPayload,
  "index.notesByTag": tagPayload,
  "index.resolve": resolvePayload,
  "index.tags": emptyPayload,
  "index.notes": emptyPayload,
  "index.rebuild": emptyPayload,
};
