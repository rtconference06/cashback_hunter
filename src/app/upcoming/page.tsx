import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { UpcomingCheck } from "@/components/forms";
import { PageFallback } from "@/components/fallback";
import { formatMoney } from "@/lib/money";
import { listUpcoming } from "@/lib/people";
import { occasionKindLabel } from "@/lib/validation";

export const metadata = { title: "Upcoming" };

export default function UpcomingPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <UpcomingDesk />
    </Suspense>
  );
}

async function UpcomingDesk() {
  await connection();
  const rows = await listUpcoming();
  return (
    <main id="upcoming" className="mx-auto w-full max-w-[900px] px-5 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#252525]">Upcoming</h1>
          <p className="mt-2 max-w-xl text-sm text-[#575757]">
            Every active person, sorted by date. Overdue occasions stay put until you mark them complete.
          </p>
        </div>
        <UpcomingCheck />
      </div>
      {rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-[#DDDDDD] px-6 py-12 text-sm text-[#575757]">
          No upcoming occasions.
        </p>
      ) : (
        <ol className="mt-6 divide-y divide-[#DDDDDD] overflow-hidden rounded-xl border border-[#DDDDDD] bg-white">
          {rows.map((row) => (
            <li key={row.occasionId}>
              <Link href={`/people/${row.personId}`} className="grid gap-1 px-4 py-4 hover:bg-[#F6EEFB] sm:grid-cols-[8rem_1fr_auto] sm:items-center">
                <p className={`text-sm font-bold ${row.days != null && row.days < 0 ? "text-[#8529CD]" : "text-[#252525]"}`}>
                  {row.label}
                </p>
                <div>
                  <p className="font-bold text-[#252525]">
                    {row.title} <span className="font-medium text-[#575757]">· {row.personName}</span>
                  </p>
                  <p className="text-sm text-[#575757]">
                    {occasionKindLabel(row.kind)}
                    {row.hobbies.length ? ` · ${row.hobbies.join(", ")}` : ""}
                  </p>
                </div>
                <p className="text-sm text-[#575757]">{formatMoney(row.budgetCents)}</p>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 text-sm">
        <Link href="/digests" className="font-semibold text-[#8529CD]">
          Digests
        </Link>
      </p>
    </main>
  );
}
