import { useEffect, useState } from "react";
import { api, type TagCount } from "../api/client";

export function TagPane({ onPickTag }: { onPickTag: (tag: string) => void }) {
  const [tags, setTags] = useState<TagCount[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .tags()
      .then((response) => {
        if (!cancelled) {
          setTags([...response.tags].sort((a, b) => a.tag.localeCompare(b.tag)));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTags([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (tags.length === 0) {
    return <div className="panel-empty">No tags yet.</div>;
  }

  return (
    <ul className="tag-list">
      {tags.map((entry) => (
        <li key={entry.tag}>
          <button
            className="tag-item"
            data-testid={`tag-${entry.tag}`}
            style={{ paddingLeft: `${8 + depthOf(entry.tag) * 12}px` }}
            onClick={() => onPickTag(entry.tag)}
          >
            <span className="tag-name">#{leafOf(entry.tag)}</span>
            <span className="tag-count">{entry.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Nesting depth of a hierarchical tag ("a/b/c" → 2). */
function depthOf(tag: string): number {
  return tag.split("/").length - 1;
}

/** Leaf segment of a nested tag ("a/b" → "b"). */
function leafOf(tag: string): string {
  const parts = tag.split("/");
  return parts[parts.length - 1];
}
