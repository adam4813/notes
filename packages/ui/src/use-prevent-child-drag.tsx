import { DragEvent } from "react";

export function usePreventChildDrag() {
  return {
    draggable: true, // Must be true to fire onDragStart, so it can be canceled
    onDragStart: (e: DragEvent) => {
      e.stopPropagation();
      e.preventDefault();
    },
  };
}
