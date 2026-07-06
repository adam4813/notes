export function PlaceholderView({ kind, note }: { kind: string; note: string }) {
  return (
    <div className="placeholder-view">
      <div className="placeholder-icon">🚧</div>
      <h2>{kind} view</h2>
      <p>{note}</p>
    </div>
  );
}
