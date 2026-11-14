import type { ReactNode } from "react";

export function OccasionCompletionCard({
  title,
  detail,
  offer,
  children,
}: {
  title: string;
  detail: string;
  offer: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="rounded-3xl border border-line bg-card p-4 sm:p-5">
      <p className="font-serif text-2xl">{title}</p>
      <p className="text-sm text-muted">{detail}</p>
      {offer ? children : <p className="mt-3 text-sm text-muted">Completed for this occurrence.</p>}
    </li>
  );
}
