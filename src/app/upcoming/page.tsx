import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { UpcomingCheck } from "@/components/forms";
import { PageFallback } from "@/components/fallback";
import { UpcomingList } from "@/components/upcoming-list";
import { listUpcoming } from "@/lib/people";

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
      <UpcomingList rows={rows} />
      <p className="mt-6 text-sm">
        <Link href="/digests" className="font-semibold text-[#8529CD]">
          Digests
        </Link>
      </p>
    </main>
  );
}
