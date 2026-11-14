import { Suspense } from "react";
import { connection } from "next/server";
import { PageFallback } from "@/components/fallback";
import { HistoryTimeline } from "@/components/history-timeline";
import { prisma, getOwner } from "@/lib/db";

export const metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <History />
    </Suspense>
  );
}

async function History() {
  await connection();
  const owner = await getOwner();
  const purchases = await prisma.purchase.findMany({
    where: { person: { userId: owner.id } },
    include: { person: true },
    orderBy: [{ purchasedOn: "desc" }, { createdAt: "desc" }],
  });
  return (
    <main id="history" className="mx-auto w-full max-w-[800px] px-5 py-8">
      <h1 className="text-3xl font-bold text-[#252525]">History</h1>
      <p className="mt-2 text-sm text-[#575757]">Completed occasions and what was bought. Archived people stay in this record.</p>
      <HistoryTimeline
        purchases={purchases.map((purchase) => ({
          id: purchase.id,
          personId: purchase.personId,
          personName: purchase.person.name,
          occasionTitle: purchase.occasionTitle,
          occasionKind: purchase.occasionKind,
          purchasedOn: purchase.purchasedOn,
          noGift: purchase.noGift,
          title: purchase.title,
          priceCents: purchase.priceCents,
          store: purchase.store,
          link: purchase.link,
          imageUrl: purchase.imageUrl,
          note: purchase.note,
        }))}
      />
    </main>
  );
}
