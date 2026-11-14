import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { restorePersonAction } from "@/app/actions";
import { PageFallback } from "@/components/fallback";
import { Button } from "@/components/ui";
import { listArchivedPeople } from "@/lib/people";

export const metadata = { title: "Archived" };

export default function ArchivedPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ArchivedList />
    </Suspense>
  );
}

async function ArchivedList() {
  await connection();
  const people = await listArchivedPeople();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-forest">Archive</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">Archived people</h1>
      <p className="mt-3 text-muted">
        Archiving hides someone from the lists and the digest. Their occasions and purchase history stay put. Restoring brings all of it back. There is no permanent delete.
      </p>
      {people.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-dashed border-line bg-card px-6 py-12 text-muted">No one is archived.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
          {people.map((person) => (
            <li key={person.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link href={`/people/${person.id}`} className="font-serif text-2xl hover:underline">
                  {person.name}
                </Link>
                <p className="text-sm text-muted">
                  {person.relationship} · {person._count.occasions} occasions · {person._count.purchases} purchases
                </p>
              </div>
              <form action={restorePersonAction}>
                <input type="hidden" name="personId" value={person.id} />
                <Button type="submit" variant="secondary">
                  Restore
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
