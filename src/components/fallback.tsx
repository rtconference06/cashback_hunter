export function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="h-4 w-28 animate-pulse rounded-full bg-line" />
      <div className="mt-4 h-12 w-2/3 animate-pulse rounded-2xl bg-line" />
      <div className="mt-8 grid gap-4">
        <div className="h-28 animate-pulse rounded-3xl bg-card" />
        <div className="h-28 animate-pulse rounded-3xl bg-card" />
      </div>
    </div>
  );
}
