import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageFallback } from "@/components/fallback";
import { ProductImage } from "@/components/product-image";
import { formatDayWithYear } from "@/lib/dates";
import { prisma, getOwner } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { occasionKindLabel } from "@/lib/validation";

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
      {purchases.length === 0 ? (
        <p className="mt-8 text-sm text-[#575757]">Nothing completed yet.</p>
      ) : (
        <ol className="mt-6 border-l border-[#DDDDDD] pl-5">
          {purchases.map((purchase) => (
            <li key={purchase.id} className="relative pb-6">
              <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[#8529CD]" />
              <p className="text-xs font-semibold uppercase tracking-wide text-[#575757]">{formatDayWithYear(purchase.purchasedOn)}</p>
              <p className="mt-1 text-lg font-bold text-[#252525]">
                <Link href={`/people/${purchase.personId}`} className="hover:text-[#8529CD]">
                  {purchase.person.name}
                </Link>
                <span className="font-medium text-[#575757]"> · {purchase.occasionTitle}</span>
              </p>
              <p className="text-sm text-[#575757]">{occasionKindLabel(purchase.occasionKind)}</p>
              {purchase.noGift ? (
                <p className="mt-1 text-sm">No gift</p>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#F6F6F6]">
                    <ProductImage src={purchase.imageUrl} alt={purchase.title || "Purchase"} />
                  </div>
                  <p className="text-sm">
                    {purchase.title}
                    {purchase.priceCents != null ? ` · ${formatMoney(purchase.priceCents)}` : ""}
                    {` · ${purchase.store || "Unknown store"}`}
                  </p>
                </div>
              )}
              {purchase.note ? <p className="mt-1 text-sm text-[#575757]">{purchase.note}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
