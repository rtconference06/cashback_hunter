import Image from "next/image";
import { dismissDealAction, favoriteDealAction } from "@/app/actions";
import { NO_MATCHES_WITHIN_BUDGET, type DealView } from "@/lib/deals";
import { formatMoney } from "@/lib/money";

export function DealList({
  personId,
  deals,
  budgetCents,
  searched,
  sample,
}: {
  personId: string;
  deals: DealView[];
  budgetCents: number;
  searched: boolean;
  sample: boolean;
}) {
  if (!searched) {
    return (
      <p className="rounded-xl border border-dashed border-[#DDDDDD] bg-white px-4 py-8 text-sm text-[#575757]">
        No search yet. Use Search now to rank deals from their likes and hobbies.
      </p>
    );
  }
  if (deals.length === 0) {
    return (
      <div id="empty-deals" role="status" className="rounded-xl border border-[#DDDDDD] bg-white px-6 py-12 shadow-sm">
        <h2 className="text-2xl font-bold text-[#252525]">{NO_MATCHES_WITHIN_BUDGET}</h2>
        <p className="mt-2 max-w-xl text-sm text-[#575757]">
          Nothing for this search came in at {formatMoney(budgetCents)} or less after cash back, once dislikes were
          removed. This is not an error.
        </p>
      </div>
    );
  }

  return (
    <ol id="deals" className="grid grid-cols-2 gap-4 xl:grid-cols-5">
      {deals.map((deal) => (
        <li key={deal.link} className="flex flex-col rounded-xl border border-[#DDDDDD] bg-white p-3 shadow-sm">
          <div className="relative">
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#F6F6F6]">
              {deal.imageUrl ? (
                <Image src={deal.imageUrl} alt="" width={160} height={120} unoptimized className="h-full w-full object-contain p-3" />
              ) : (
                <span className="text-3xl font-bold text-[#8529CD]">{deal.title.slice(0, 1)}</span>
              )}
            </div>
            <span className="absolute left-2 top-2 rounded-md bg-[#8529CD] px-1.5 py-0.5 text-[11px] font-bold text-white">
              {Math.round(deal.cashbackPercent)}%
            </span>
            <div className="absolute right-2 top-2 flex gap-1">
              <form action={favoriteDealAction}>
                <input type="hidden" name="personId" value={personId} />
                <input type="hidden" name="link" value={deal.link} />
                <button
                  type="submit"
                  aria-label={deal.favorite ? "Favorited" : "Favorite"}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#8529CD] shadow-sm"
                >
                  <Heart filled={deal.favorite} />
                </button>
              </form>
              <form action={dismissDealAction}>
                <input type="hidden" name="personId" value={personId} />
                <input type="hidden" name="link" value={deal.link} />
                <button type="submit" aria-label="Dismiss" className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#575757] shadow-sm">
                  <XIcon />
                </button>
              </form>
            </div>
          </div>
          <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-[#252525]">{deal.title}</h3>
          <p className="mt-1 text-sm font-bold text-[#8529CD]">{deal.store}</p>
          <p className="mt-2 text-sm font-semibold text-[#252525]">{formatMoney(deal.priceCents)}</p>
          <p className="text-sm font-semibold text-[#8529CD]">{formatCashBack(deal.cashbackPercent)}</p>
          <p className="text-sm text-[#575757]">Final price {formatMoney(deal.effectivePriceCents)}</p>
          <p className="mt-1 line-clamp-2 text-xs text-[#575757]">{deal.whyMatched}</p>
          <a
            href={deal.link}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-[#8529CD] text-sm font-semibold text-white hover:bg-[#6f1fb0]"
          >
            {sample ? "Shop now" : "Shop now"}
          </a>
        </li>
      ))}
    </ol>
  );
}

function formatCashBack(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return percent > 0 ? `${label}% Cash Back` : "No cash back";
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 12.2 6.1 11.4C3.2 8.8 1.4 7.2 1.4 5.2A2.6 2.6 0 0 1 4 2.6c.9 0 1.7.4 2.3 1.1A3 3 0 0 1 8.6 2.6a2.6 2.6 0 0 1 2.6 2.6c0 2-1.8 3.6-4.7 6.2L7 12.2Z"
        fill={filled ? "#8529CD" : "none"}
        stroke="#8529CD"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 2l8 8M10 2 2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
