import { prisma } from "@/lib/db";
import {
  maxDealsFromEnv,
  NO_MATCHES_WITHIN_BUDGET,
  rankDeals,
  toDealView,
  type DealView,
  type SavedMark,
} from "@/lib/deals";
import { resolveBudgetCents } from "@/lib/dates";
import { parseStoredList } from "@/lib/lists";
import { buildSearchPlan } from "@/lib/plan";
import { selectDealProvider, type DealProvider } from "@/lib/providers";
import { createOccasion, requirePerson } from "@/lib/people";
import { ValidationError } from "@/lib/validation";

export type SearchResult = {
  deals: DealView[];
  message: string | null;
  searchRunId: string;
  budgetCents: number;
  provider: string;
  occasionId: string | null;
};

export async function runSearch(input: {
  personId: string;
  occasionId?: string | null;
  provider?: DealProvider;
  limit?: number;
}): Promise<SearchResult> {
  const person = await requirePerson(input.personId);
  const occasion = input.occasionId ? person.occasions.find((item) => item.id === input.occasionId) : null;
  if (input.occasionId && !occasion) throw new ValidationError("That occasion is not on this person.");

  const mode = occasion?.kind === "adhoc" ? "adhoc" : "gift";
  const likes = parseStoredList(person.likes);
  const dislikes = parseStoredList(person.dislikes);
  const hobbies = parseStoredList(person.hobbies);
  const budgetCents = resolveBudgetCents(person.defaultBudgetCents, occasion?.budgetCents);
  const plan = buildSearchPlan({
    likes,
    hobbies,
    dislikes,
    occasionTitle: occasion?.title,
    occasionNotes: occasion?.notes,
    mode,
  });
  const provider = input.provider ?? selectDealProvider();
  const candidates = await provider.search(plan);
  const saved: SavedMark[] = person.savedDeals.map((mark) => ({
    productKey: mark.productKey,
    state: mark.state,
  }));
  const limit = input.limit ?? maxDealsFromEnv();
  const ranked = rankDeals(
    {
      likes,
      dislikes,
      hobbies,
      budgetCents,
      requestTerms: mode === "adhoc" ? plan.queries : plan.queries.filter((query) => !likes.includes(query) && !hobbies.includes(query)),
      mode,
      limit: Math.max(limit * 3, limit),
      saved,
    },
    candidates,
  );
  const visible = ranked.slice(0, limit);

  const run = await prisma.searchRun.create({
    data: {
      personId: person.id,
      occasionId: occasion?.id ?? null,
      provider: provider.name,
      query: plan.queries.join(" | "),
      budgetCents,
      options: {
        create: ranked.map((deal) => ({
          title: deal.title,
          description: deal.description,
          priceCents: deal.priceCents,
          cashbackPercent: deal.cashbackPercent,
          effectivePriceCents: deal.effectivePriceCents,
          category: deal.category,
          store: deal.store,
          imageUrl: deal.imageUrl,
          link: deal.link,
          whyMatched: deal.whyMatched,
          rank: deal.rank,
          score: deal.score,
          favorite: deal.favorite,
        })),
      },
    },
  });

  return {
    deals: visible.map(toDealView),
    message: visible.length === 0 ? NO_MATCHES_WITHIN_BUDGET : null,
    searchRunId: run.id,
    budgetCents,
    provider: provider.name,
    occasionId: occasion?.id ?? null,
  };
}

export async function searchAdhocNeed(
  personId: string,
  input: { need: string; deadline?: string | null },
  provider?: DealProvider,
) {
  const occasion = await createOccasion(personId, {
    kind: "adhoc",
    title: input.need,
    date: input.deadline ?? "",
    recurring: false,
    budget: "",
    notes: "",
  });
  const result = await runSearch({ personId, occasionId: occasion.id, provider });
  return result;
}
