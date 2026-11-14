import Link from "next/link";
import { formatDateInput, formatDayWithYear } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { UpcomingRow } from "@/lib/upcoming";
import { occasionKindLabel } from "@/lib/validation";

export function UpcomingList({ rows }: { rows: UpcomingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-[#DDDDDD] px-6 py-12 text-sm text-[#575757]">
        No upcoming occasions.
      </p>
    );
  }
  return (
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
                {row.occurrence ? (
                  <>
                    {" · "}
                    <time dateTime={formatDateInput(row.occurrence)}>{formatDayWithYear(row.occurrence)}</time>
                  </>
                ) : null}
                {row.hobbies.length ? ` · ${row.hobbies.join(", ")}` : ""}
              </p>
            </div>
            <p className="text-sm text-[#575757]">{formatMoney(row.budgetCents)}</p>
          </Link>
        </li>
      ))}
    </ol>
  );
}
