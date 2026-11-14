import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type FileHistory, type VersionDiff } from "../api/client";

/** Query key factory for all version-history data. */
export const historyKeys = {
  all: ["history"] as const,
  status: () => [...historyKeys.all, "status"] as const,
  log: (path: string) => [...historyKeys.all, "log", path] as const,
  diff: (path: string, oid: string) => [...historyKeys.all, "diff", path, oid] as const,
};

/** Lists the saved versions that touched a given note file. */
export function useFileHistory(path: string | null) {
  return useQuery<FileHistory>({
    queryKey: historyKeys.log(path ?? ""),
    queryFn: () => api.history.log(path as string),
    enabled: Boolean(path),
  });
}

/** Loads the diff and full content for one saved version of a file. */
export function useVersionDiff(path: string | null, oid: string | null) {
  return useQuery<VersionDiff>({
    queryKey: historyKeys.diff(path ?? "", oid ?? ""),
    queryFn: () => api.history.diff(path as string, oid as string),
    enabled: Boolean(path) && Boolean(oid),
  });
}

/** Saves a new version (git commit) of the whole Tome. */
export function useSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message?: string) => api.history.snapshot(message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}
