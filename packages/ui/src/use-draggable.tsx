import { DragEvent } from "react";

export function useDraggable<T>(
  {
    isDraggable = true,
    onDragStart = () => {},
    onDragEnd = () => {},
  }: {
    isDraggable: boolean;
    onDragStart: (event: DragEvent, ...data: T[]) => void;
    onDragEnd: () => void;
  },
  ...data: T[]
) {
  return {
    draggable: isDraggable,
    onDragStart: (event: DragEvent) => {
      event.stopPropagation();
      onDragStart(event, ...data);
      event.currentTarget.classList.add("drag-hidden");
    },
    onDragEnd: (event: DragEvent) => {
      event.currentTarget.classList.remove("drag-hidden");
      onDragEnd();
    },
  };
}
