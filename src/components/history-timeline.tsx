import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { PurchaseLink } from "@/components/purchase-link";
import { formatDayWithYear } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { occasionKindLabel } from "@/lib/validation";

export type HistoryEntry = {
  id: string;
  personId: string;
  personName: string;
  occasionTitle: string;
  occasionKind: string;
  purchasedOn: Date;
  noGift: boolean;
  title: string;
  priceCents: number | null;
  store: string;
  link: string;
  imageUrl: string;
  note: string;
};

export function HistoryTimeline({ purchases }: { purchases: HistoryEntry[] }) {
  if (purchases.length === 0) {
    return <p className="mt-8 text-sm text-[#575757]">Nothing completed yet.</p>;
  }
  return (
    <ol className="mt-6 border-l border-[#DDDDDD] pl-5">
      {purchases.map((purchase) => (
        <li key={purchase.id} className="relative pb-6">
          <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[#8529CD]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#575757]">{formatDayWithYear(purchase.purchasedOn)}</p>
          <p className="mt-1 text-lg font-bold text-[#252525]">
            <Link href={`/people/${purchase.personId}`} className="hover:text-[#8529CD]">
              {purchase.personName}
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
          <PurchaseLink link={purchase.link} className="mt-1 block text-sm font-semibold text-[#8529CD] underline" />
          {purchase.note ? <p className="mt-1 text-sm text-[#575757]">{purchase.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
