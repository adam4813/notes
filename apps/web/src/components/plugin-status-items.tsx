import { useEffect, useRef } from "react";
import type { StatusBarItem } from "@notes/plugin-host";

/** Renders plugin-contributed status-bar items by mounting them into host elements. */
export function PluginStatusItems({ items }: { items: StatusBarItem[] }) {
  return (
    <>
      {items.map((item) => (
        <PluginStatusSlot key={item.id} item={item} />
      ))}
    </>
  );
}

function PluginStatusSlot({ item }: { item: StatusBarItem }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const dispose = item.mount(element);
    return () => {
      if (typeof dispose === "function") {
        dispose();
      }
      element.replaceChildren();
    };
  }, [item]);

  return <span className="status-plugin-item" ref={ref} />;
}
