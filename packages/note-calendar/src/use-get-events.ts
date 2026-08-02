import { useQuery } from "@tanstack/react-query";
import { parseCalendar, RichEvent } from "./calendar-format";

export function useGetEvents(path: string, value?: string) {
  return useQuery({
    queryKey: ["events", path],
    queryFn: async () => {
      const res = await fetch(`/api/events?calendarPath=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("fetch failed");
      const fileRes = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      if (!fileRes.ok) throw new Error("fetch failed");

      const data = (await res.json()) as { events: RichEvent[] };
      const fileData = (await fileRes.json()) as { content: string };
      return {
        model: parseCalendar(fileData.content),
        events: data.events,
      };
    },
    initialData: value
      ? {
          model: parseCalendar(value),
          events: [],
        }
      : undefined,
  });
}
