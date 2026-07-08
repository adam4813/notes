export interface FileEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  children?: FileEntry[];
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
}

export interface Backlink {
  path: string;
  title: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface SearchFilters {
  tag?: string;
  type?: string;
  path?: string;
  limit?: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined && init.body !== null;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const query = (params: Record<string, string>): string => new URLSearchParams(params).toString();

export const api = {
  files: () => request<{ entries: FileEntry[] }>("/api/files"),
  read: (path: string) => request<{ path: string; content: string }>(`/api/file?${query({ path })}`),
  write: (path: string, content: string) =>
    request<{ path: string }>("/api/file", {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    }),
  create: (path: string, content = "") =>
    request<{ path: string }>("/api/file", {
      method: "POST",
      body: JSON.stringify({ path, content }),
    }),
  remove: (path: string) =>
    request<{ path: string }>(`/api/file?${query({ path })}`, { method: "DELETE" }),
  mkdir: (path: string) =>
    request<{ path: string }>("/api/folder", { method: "POST", body: JSON.stringify({ path }) }),
  rename: (from: string, to: string) =>
    request<{ from: string; to: string }>("/api/file/rename", {
      method: "POST",
      body: JSON.stringify({ from, to }),
    }),
  search: (q: string, filters: SearchFilters = {}) =>
    request<{ results: SearchResult[] }>(
      `/api/search?${query({
        q,
        ...(filters.tag ? { tag: filters.tag } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.path ? { path: filters.path } : {}),
        ...(filters.limit ? { limit: String(filters.limit) } : {}),
      })}`,
    ),
  tag: (tag: string) => request<{ paths: string[] }>(`/api/tag?${query({ tag })}`),
  backlinks: (path: string) =>
    request<{ backlinks: Backlink[] }>(`/api/backlinks?${query({ path })}`),
  tags: () => request<{ tags: TagCount[] }>("/api/tags"),
  notes: () =>
    request<{ notes: { path: string; title: string; type: string }[] }>("/api/notes"),
  resolve: (text: string) => request<{ path: string | null }>(`/api/resolve?${query({ text })}`),
  reindex: () => request<{ rebuilt: boolean; notes: number }>("/api/reindex", { method: "POST" }),
  tome: () => request<{ id: string }>("/api/tome"),
};
