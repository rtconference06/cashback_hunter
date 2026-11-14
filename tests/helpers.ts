import { prisma } from "@/lib/db";
import type { DealCandidate } from "@/lib/deals";

export async function resetDb() {
  await prisma.savedDeal.deleteMany();
  await prisma.productOption.deleteMany();
  await prisma.digest.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.searchRun.deleteMany();
  await prisma.occasion.deleteMany();
  await prisma.person.deleteMany();
  await prisma.user.deleteMany();
}

export function candidate(overrides: Partial<DealCandidate> & Pick<DealCandidate, "title" | "priceCents">): DealCandidate {
  return {
    id: overrides.id ?? overrides.title,
    description: "",
    category: "General",
    cashbackPercent: 0,
    store: "REI",
    imageUrl: "",
    link: `https://example.com/${encodeURIComponent(overrides.title)}`,
    keywords: "",
    ...overrides,
  };
}

export const validPerson = {
  name: "Maya Chen",
  relationship: "Sister",
  likes: "ceramic mugs, matcha",
  dislikes: "scented candles",
  hobbies: "pottery, reading",
  budget: "60",
  notes: "Prefers useful things.",
};
