import { z } from "zod";

/** Zod schemas for command payloads, used by the server validation middleware. */

export const filePathPayload = z.object({ path: z.string().min(1) });
export const fileWritePayload = z.object({ path: z.string().min(1), content: z.string().default("") });
export const fileMovePayload = z.object({ from: z.string().min(1), to: z.string().min(1) });
export const emptyPayload = z.object({}).passthrough();

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
};
