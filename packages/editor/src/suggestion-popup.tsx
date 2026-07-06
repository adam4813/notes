import type { MouseEvent } from "react";

interface SuggestionPopupProps {
  items: string[];
  activeIndex: number;
  left: number;
  top: number;
  onPick: (index: number) => void;
}

export function SuggestionPopup({ items, activeIndex, left, top, onPick }: SuggestionPopupProps) {
  const pick = (event: MouseEvent, index: number) => {
    event.preventDefault();
    onPick(index);
  };

  return (
    <div className="suggest-popup" style={{ left, top }} role="listbox">
      {items.map((item, index) => (
        <button
          key={item}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={`suggest-item ${index === activeIndex ? "suggest-item--active" : ""}`}
          onMouseDown={(event) => pick(event, index)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
