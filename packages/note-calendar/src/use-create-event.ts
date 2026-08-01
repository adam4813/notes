import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RichEvent } from "./calendar-format";

export function useCreateEvent(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) => {
      const res = await fetch("/api/event/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarPath: path, date }),
      });
      if (!res.ok) throw new Error("Failed to create event");

      const event = (await res.json()) as RichEvent;
      await queryClient.refetchQueries({ queryKey: ["events", path] });

      return event;
    },
  });
}
