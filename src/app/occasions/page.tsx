import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageFallback } from "@/components/fallback";
import { formatDayWithYear, ownerToday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { listUpcoming } from "@/lib/people";
import { occasionKindLabel } from "@/lib/validation";

export const metadata = { title: "Occasions" };

export default function OccasionsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Occasions />
    </Suspense>
  );
}

async function Occasions() {
  await connection();
  const rows = await listUpcoming(ownerToday());
  return (
    <main className="mx-auto w-full max-w-[900px] px-5 py-8">
      <h1 className="text-3xl font-bold text-[#252525]">Occasions</h1>
      <p className="mt-2 text-sm text-[#575757]">Open occasions for everyone still on your list.</p>
      <ul className="mt-6 grid gap-3">
        {rows.map((row) => (
          <li key={row.occasionId} className="rounded-xl border border-[#DDDDDD] bg-white px-4 py-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/people/${row.personId}`} className="text-lg font-bold text-[#252525] hover:text-[#8529CD]">
                {row.title}
              </Link>
              <span className="text-sm font-semibold text-[#8529CD]">{row.label}</span>
            </div>
            <p className="mt-1 text-sm text-[#575757]">
              {row.personName} · {occasionKindLabel(row.kind)}
              {row.occurrence ? ` · ${formatDayWithYear(row.occurrence)}` : ""}
              {` · ${formatMoney(row.budgetCents)}`}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
