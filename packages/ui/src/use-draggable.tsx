import { DragEvent, useMemo } from "react";

export function useDraggable<T>(
  {
    isDraggable = true,
    onDragStart = () => {},
    onDragEnd = () => {},
  }: {
    isDraggable?: boolean;
    onDragStart?: (event: DragEvent, ...data: T[]) => void;
    onDragEnd?: () => void;
  },
  ...data: T[]
) {
  return useMemo(
    () => ({
      draggable: isDraggable,
      onDragStart: (event: DragEvent) => {
        event.stopPropagation();
        const parent = event.currentTarget.parentElement;
        setTimeout(() => {
          parent?.classList.add("drag-hidden");
        });
        onDragStart(event, ...data);
      },
      onDragEnd: (event: DragEvent) => {
        event.currentTarget.parentElement?.classList.remove("drag-hidden");
        onDragEnd();
      },
    }),
    [isDraggable, onDragStart, onDragEnd, data],
  );
}
