import { z } from "zod";

/** Plugin manifest: identity + declared entry points and permissions. */
export const pluginManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, "id must be kebab-case"),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  /** Which halves the plugin contributes to (client is used in MVP). */
  entry: z
    .object({ client: z.boolean().optional(), server: z.boolean().optional() })
    .default({ client: true }),
  /** Reserved for a future capability/permission model (trusted for MVP). */
  permissions: z.array(z.string()).default([]),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export interface ManifestValidation {
  ok: boolean;
  manifest?: PluginManifest;
  error?: string;
}

export function validateManifest(input: unknown): ManifestValidation {
  const result = pluginManifestSchema.safeParse(input);
  if (result.success) {
    return { ok: true, manifest: result.data };
  }
  return { ok: false, error: result.error.issues.map((issue) => issue.message).join("; ") };
}
