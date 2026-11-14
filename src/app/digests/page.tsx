import { Suspense } from "react";
import { connection } from "next/server";
import { PageFallback } from "@/components/fallback";
import { prisma } from "@/lib/db";
import { formatTimestamp } from "@/lib/dates";

export const metadata = { title: "Digests" };

export default function DigestsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <DigestList />
    </Suspense>
  );
}

async function DigestList() {
  await connection();
  const digests = await prisma.digest.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: { person: true },
  });
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-forest">Digests</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">What was sent</h1>
      <p className="mt-3 text-muted">
        With no SMTP host or Resend key, each digest is logged here and printed in the server log with the recipient, subject, and body. Every deal line names the store.
      </p>
      {digests.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-line bg-card px-6 py-12 text-muted">
          No digests yet. They go out inside the lead window, once per occasion, and skip anyone you have archived or already marked complete.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {digests.map((digest) => (
            <li key={digest.id} className="rounded-3xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-forest">{digest.status}</p>
                <p className="text-xs text-muted">{formatTimestamp(digest.createdAt)}</p>
              </div>
              <h2 className="mt-2 font-serif text-2xl">{digest.subject}</h2>
              <p className="mt-1 text-sm text-muted">To {digest.to} · {digest.person.name}</p>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6 text-ink">{digest.bodyText}</pre>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
