import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteEvent(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(
        `/api/event?calendarPath=${encodeURIComponent(path)}&eventId=${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete event");

      return queryClient.refetchQueries({ queryKey: ["events", path] });
    },
  });
}
