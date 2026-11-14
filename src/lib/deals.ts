import { formatMoney, formatPercent } from "@/lib/money";

export const NO_MATCHES_WITHIN_BUDGET = "No matches within budget";
export const UNKNOWN_STORE = "Unknown store";

export function displayStore(store: string | null | undefined): string {
  const trimmed = store?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : UNKNOWN_STORE;
}

const STOP_WORDS = new Set(["and", "the", "for", "with", "a", "an", "of", "to", "or"]);

export type DealCandidate = {
  id: string;
  title: string;
  description: string;
  category: string;
  priceCents: number;
  cashbackPercent: number;
  store: string;
  imageUrl: string;
  link: string;
  keywords: string;
};

export type RankedDeal = DealCandidate & {
  effectivePriceCents: number;
  score: number;
  whyMatched: string;
  rank: number;
  favorite: boolean;
};

export type SavedMark = {
  productKey: string;
  state: string;
};

export function effectivePriceCents(priceCents: number, cashbackPercent: number): number {
  const percent = Math.min(100, Math.max(0, cashbackPercent));
  return Math.round((priceCents * (100 - percent)) / 100);
}

export function maxDealsFromEnv(env: { MAX_DEALS?: string; [key: string]: string | undefined } = process.env): number {
  const raw = env.MAX_DEALS;
  if (raw == null || raw.trim() === "") return 5;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 5;
  return Math.floor(value);
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function variants(token: string): string[] {
  const forms = new Set([token]);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    forms.add(token.slice(0, -1));
  } else if (token.length > 2 && !token.endsWith("s")) {
    forms.add(`${token}s`);
  }
  return [...forms];
}

export function textHasTerm(haystack: string, term: string): boolean {
  const phrase = normalizeText(term);
  if (!phrase) return false;
  const parts = phrase.split(" ").map((word) => {
    const alts = variants(word).map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return `(?:${alts.join("|")})`;
  });
  const pattern = new RegExp(`(?:^|[^a-z0-9])${parts.join("\\s+")}(?:[^a-z0-9]|$)`, "i");
  return pattern.test(normalizeText(haystack));
}

export function significantTokens(phrase: string): string[] {
  return normalizeText(phrase)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function isDisliked(product: { title: string; category: string }, dislikes: string[]): boolean {
  const haystack = `${product.title} ${product.category}`;
  return dislikes.some((dislike) => textHasTerm(haystack, dislike));
}

function requestMatches(product: DealCandidate, term: string): boolean {
  const haystack = `${product.title} ${product.description} ${product.category} ${product.keywords}`;
  if (textHasTerm(haystack, term)) return true;
  const tokens = significantTokens(term);
  return tokens.length > 0 && tokens.every((token) => textHasTerm(haystack, token));
}

function fieldLabels(text: string, phrases: string[]): string[] {
  const labels: string[] = [];
  for (const phrase of phrases) {
    if (!phrase.trim()) continue;
    if (textHasTerm(text, phrase)) {
      labels.push(phrase.trim());
      continue;
    }
    const tokens = significantTokens(phrase);
    if (tokens.length < 2) continue;
    const matched = tokens.filter((token) => textHasTerm(text, token));
    if (matched.length / tokens.length >= 0.5) labels.push(matched.join(" "));
  }
  return labels;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function compareDeals(a: RankedDeal, b: RankedDeal): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  if (a.effectivePriceCents !== b.effectivePriceCents) {
    return a.effectivePriceCents - b.effectivePriceCents;
  }
  if (a.score !== b.score) return b.score - a.score;
  return a.title.localeCompare(b.title);
}

export function finalizeDeals(deals: RankedDeal[], saved: SavedMark[], limit: number): RankedDeal[] {
  const dismissed = new Set(saved.filter((mark) => mark.state === "dismissed").map((mark) => mark.productKey));
  const favorites = new Set(saved.filter((mark) => mark.state === "favorite").map((mark) => mark.productKey));
  return deals
    .filter((deal) => !dismissed.has(deal.link))
    .map((deal) => ({ ...deal, favorite: favorites.has(deal.link) }))
    .sort(compareDeals)
    .slice(0, Math.max(0, limit))
    .map((deal, index) => ({ ...deal, rank: index + 1 }));
}

export function rankDeals(
  input: {
    likes: string[];
    dislikes: string[];
    hobbies: string[];
    budgetCents: number;
    requestTerms?: string[];
    mode?: "gift" | "adhoc";
    limit?: number;
    saved?: SavedMark[];
  },
  products: DealCandidate[],
): RankedDeal[] {
  const mode = input.mode ?? "gift";
  const requestTerms = (input.requestTerms ?? []).map((term) => term.trim()).filter(Boolean);
  const limit = input.limit ?? maxDealsFromEnv();
  const ranked: RankedDeal[] = [];

  for (const product of products) {
    if (product.priceCents <= 0) continue;
    if (isDisliked(product, input.dislikes)) continue;

    const cashbackPercent = Math.min(100, Math.max(0, product.cashbackPercent));
    const effective = effectivePriceCents(product.priceCents, cashbackPercent);
    if (effective > input.budgetCents) continue;

    const likeTitle = fieldLabels(product.title, input.likes);
    const likeCategory = fieldLabels(product.category, input.likes);
    const likeDetail = fieldLabels(`${product.description} ${product.keywords}`, input.likes);
    const hobbyTitle = fieldLabels(product.title, input.hobbies);
    const hobbyCategory = fieldLabels(product.category, input.hobbies);
    const hobbyDetail = fieldLabels(`${product.description} ${product.keywords}`, input.hobbies);
    const requestHits = requestTerms.filter((term) => requestMatches(product, term));

    const preferenceHits =
      likeTitle.length +
      likeCategory.length +
      likeDetail.length +
      hobbyTitle.length +
      hobbyCategory.length +
      hobbyDetail.length;

    if (mode === "adhoc") {
      if (requestHits.length === 0) continue;
    } else if (preferenceHits === 0 && requestHits.length === 0) {
      continue;
    }

    const score =
      likeTitle.length * 8 +
      likeCategory.length * 5 +
      likeDetail.length * 3 +
      hobbyTitle.length * 6 +
      hobbyCategory.length * 4 +
      hobbyDetail.length * 2 +
      requestHits.length * (mode === "adhoc" ? 12 : 2);

    const interests = unique([
      ...likeTitle,
      ...likeCategory,
      ...likeDetail,
      ...hobbyTitle,
      ...hobbyCategory,
      ...hobbyDetail,
    ]).slice(0, 3);

    const sentences: string[] = [];
    if (mode === "adhoc" && requestHits[0]) {
      sentences.push(`Matches the request “${requestHits[0]}”.`);
    }
    if (interests.length > 0) sentences.push(`Lines up with ${interests.join(", ")}.`);
    if (cashbackPercent > 0) {
      sentences.push(
        `${formatMoney(effective)} after ${formatPercent(cashbackPercent)} cashback is inside the ${formatMoney(input.budgetCents)} budget.`,
      );
    } else {
      sentences.push(`${formatMoney(product.priceCents)} is inside the ${formatMoney(input.budgetCents)} budget.`);
    }

    ranked.push({
      ...product,
      store: displayStore(product.store),
      cashbackPercent,
      effectivePriceCents: effective,
      score,
      whyMatched: sentences.join(" "),
      rank: 0,
      favorite: false,
    });
  }

  return finalizeDeals(ranked, input.saved ?? [], limit);
}

export type DealView = {
  title: string;
  store: string;
  priceCents: number;
  cashbackPercent: number;
  effectivePriceCents: number;
  link: string;
  whyMatched: string;
  favorite: boolean;
  rank: number;
  imageUrl: string;
};

export function dealsFromStored(
  options: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    priceCents: number;
    cashbackPercent: number;
    effectivePriceCents: number;
    store: string;
    imageUrl: string;
    link: string;
    whyMatched: string;
    rank: number;
    score: number;
    favorite: boolean;
  }>,
  saved: SavedMark[],
  limit: number,
): DealView[] {
  const ranked: RankedDeal[] = options.map((option) => ({
    id: option.id,
    title: option.title,
    description: option.description,
    category: option.category,
    priceCents: option.priceCents,
    cashbackPercent: option.cashbackPercent,
    effectivePriceCents: option.effectivePriceCents,
    store: displayStore(option.store),
    imageUrl: option.imageUrl,
    link: option.link,
    keywords: "",
    whyMatched: option.whyMatched,
    rank: option.rank,
    score: option.score,
    favorite: option.favorite,
  }));
  return finalizeDeals(ranked, saved, limit).map(toDealView);
}

export function toDealView(deal: RankedDeal): DealView {
  return {
    title: deal.title,
    store: deal.store,
    priceCents: deal.priceCents,
    cashbackPercent: deal.cashbackPercent,
    effectivePriceCents: deal.effectivePriceCents,
    link: deal.link,
    whyMatched: deal.whyMatched,
    favorite: deal.favorite,
    rank: deal.rank,
    imageUrl: deal.imageUrl,
  };
}
