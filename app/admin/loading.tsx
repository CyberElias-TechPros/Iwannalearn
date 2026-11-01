export default function Loading() {
  return (
    <div className="wrap py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-3 w-24 animate-pulse rounded-full bg-line" />
      <div className="mt-4 h-9 w-2/3 max-w-lg animate-pulse rounded-lg bg-line/80" />
      <div className="mt-3 h-4 w-1/2 max-w-md animate-pulse rounded bg-line/60" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface h-56 animate-pulse bg-paper-2/40" />
        ))}
      </div>
    </div>
  );
}
