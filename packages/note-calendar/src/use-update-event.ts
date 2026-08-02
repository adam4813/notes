import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RichEvent } from "./calendar-format";

export function useUpdateEvent(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RichEvent) => {
      const res = await fetch("/api/event/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarPath: path, event: data }),
      });
      if (!res.ok) throw new Error("Failed to update event");

      const event = (await res.json()) as RichEvent;
      await queryClient.refetchQueries({ queryKey: ["events", path] });

      return event;
    },
  });
}
