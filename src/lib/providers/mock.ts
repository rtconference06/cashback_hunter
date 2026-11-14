import { significantTokens, textHasTerm, type DealCandidate } from "@/lib/deals";
import type { SearchPlan } from "@/lib/plan";
import type { DealProvider } from "@/lib/providers/types";
import { MOCK_CATALOG } from "@/lib/providers/mock-catalog";

function matchesQuery(product: DealCandidate, query: string): boolean {
  const haystack = `${product.title} ${product.description} ${product.category} ${product.keywords}`;
  if (textHasTerm(haystack, query)) return true;
  return significantTokens(query).some((token) => textHasTerm(haystack, token));
}

export const mockProvider: DealProvider = {
  name: "mock",
  async search(plan: SearchPlan): Promise<DealCandidate[]> {
    const found = new Map<string, DealCandidate>();
    for (const query of plan.queries) {
      for (const product of MOCK_CATALOG) {
        if (matchesQuery(product, query)) found.set(product.link, product);
      }
    }
    return [...found.values()];
  },
};
