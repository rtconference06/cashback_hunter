import { Prisma } from "@prisma/client";
import { prisma, getOwner } from "@/lib/db";
import { activeOccurrence, ownerToday, parseDateInput, recursYearly } from "@/lib/dates";
import { displayStore } from "@/lib/deals";
import { safeImageUrl } from "@/lib/product-image";
import { parseStoredList } from "@/lib/lists";
import { dollarsToCents } from "@/lib/money";
import {
  occurrenceKeyFor,
  resolveCompletionTarget,
  shouldAcceptNewCompletion,
  storedPurchaseOccurrenceKey,
} from "@/lib/completion";
import {
  OCCASION_KINDS,
  ValidationError,
  parseOptionalBudget,
  parsePerson,
  parsePurchaseLink,
  type PersonInput,
} from "@/lib/validation";
import { upcomingForPeople, type UpcomingPerson, type UpcomingRow } from "@/lib/upcoming";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

const personInclude = {
  occasions: { orderBy: { createdAt: "asc" as const } },
  purchases: { orderBy: [{ purchasedOn: "desc" as const }, { createdAt: "desc" as const }] },
  savedDeals: true,
  searchRuns: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: { options: { orderBy: { rank: "asc" as const } }, occasion: true },
  },
};

export async function createPerson(input: PersonInput) {
  const parsed = parsePerson(input);
  const owner = await getOwner();
  return prisma.person.create({
    data: {
      userId: owner.id,
      name: parsed.name,
      relationship: parsed.relationship,
      email: parsed.email,
      likes: JSON.stringify(parsed.likes),
      dislikes: JSON.stringify(parsed.dislikes),
      hobbies: JSON.stringify(parsed.hobbies),
      defaultBudgetCents: parsed.budgetCents,
      notes: parsed.notes,
    },
  });
}

export async function updatePerson(id: string, input: PersonInput) {
  const parsed = parsePerson(input);
  await requirePerson(id);
  return prisma.person.update({
    where: { id },
    data: {
      name: parsed.name,
      relationship: parsed.relationship,
      email: parsed.email,
      likes: JSON.stringify(parsed.likes),
      dislikes: JSON.stringify(parsed.dislikes),
      hobbies: JSON.stringify(parsed.hobbies),
      defaultBudgetCents: parsed.budgetCents,
      notes: parsed.notes,
    },
  });
}

export async function getPerson(id: string) {
  const owner = await getOwner();
  return prisma.person.findFirst({
    where: { id, userId: owner.id },
    include: personInclude,
  });
}

export async function requirePerson(id: string) {
  const person = await getPerson(id);
  if (!person) throw new NotFoundError("That person is not on your list.");
  return person;
}

async function peopleWithOccasions() {
  const owner = await getOwner();
  const people = await prisma.person.findMany({
    where: { userId: owner.id },
    include: { occasions: true },
    orderBy: { name: "asc" },
  });
  return people.map(toUpcomingPerson);
}

function toUpcomingPerson(person: {
  id: string;
  name: string;
  relationship: string;
  hobbies: string;
  archivedAt: Date | null;
  defaultBudgetCents: number;
  occasions: {
    id: string;
    kind: string;
    title: string;
    date: Date | null;
    recurring: boolean;
    status: string;
    lastCompletedOn: Date | null;
    budgetCents: number | null;
  }[];
}): UpcomingPerson {
  return {
    id: person.id,
    name: person.name,
    relationship: person.relationship,
    hobbies: parseStoredList(person.hobbies),
    archivedAt: person.archivedAt,
    defaultBudgetCents: person.defaultBudgetCents,
    occasions: person.occasions,
  };
}

export async function listUpcoming(now = new Date()): Promise<UpcomingRow[]> {
  const today = ownerToday(now);
  const people = await peopleWithOccasions();
  return upcomingForPeople(people, today);
}

export async function listPeople(now = new Date()) {
  const today = ownerToday(now);
  const owner = await getOwner();
  const people = await prisma.person.findMany({
    where: { userId: owner.id, archivedAt: null },
    include: { occasions: true },
    orderBy: { name: "asc" },
  });
  const upcoming = upcomingForPeople(people.map(toUpcomingPerson), today);
  return people.map((person) => ({
    ...person,
    hobbies: parseStoredList(person.hobbies),
    likes: parseStoredList(person.likes),
    dislikes: parseStoredList(person.dislikes),
    nextOccasion: upcoming.find((row) => row.personId === person.id) ?? null,
  }));
}

export async function listArchivedPeople() {
  const owner = await getOwner();
  return prisma.person.findMany({
    where: { userId: owner.id, archivedAt: { not: null } },
    include: { _count: { select: { occasions: true, purchases: true } } },
    orderBy: { name: "asc" },
  });
}

/** Archive is idempotent. A second archive keeps the original timestamp and does not throw. */
export async function archivePerson(id: string) {
  const person = await requirePerson(id);
  if (person.archivedAt) return person;
  return prisma.person.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}

/** Restore is idempotent. A second restore leaves the record active and does not throw. */
export async function restorePerson(id: string) {
  const person = await requirePerson(id);
  if (!person.archivedAt) return person;
  return prisma.person.update({
    where: { id },
    data: { archivedAt: null },
  });
}

export type OccasionInput = {
  kind: string;
  title: string;
  date: string;
  recurring: boolean;
  budget: string;
  notes: string;
};

export async function createOccasion(personId: string, input: OccasionInput) {
  await requirePerson(personId);
  const kind = input.kind.trim();
  if (!OCCASION_KINDS.includes(kind as (typeof OCCASION_KINDS)[number])) {
    throw new ValidationError("Choose a birthday, anniversary, Teachers' Day, holiday, custom event, or ad-hoc need.");
  }
  const title = input.title.trim();
  if (!title) throw new ValidationError(kind === "adhoc" ? "Describe what you need to buy." : "Give the occasion a name.");
  const date = input.date.trim() ? parseDateInput(input.date) : null;
  if (input.date.trim() && !date) throw new ValidationError("That date is not a real calendar day.");
  if (kind !== "adhoc" && !date) throw new ValidationError("Add a date for this occasion.");
  const budgetCents = parseOptionalBudget(input.budget);
  const recurring = recursYearly(kind, input.recurring);
  return prisma.occasion.create({
    data: {
      personId,
      kind,
      title,
      date,
      recurring,
      budgetCents,
      notes: input.notes.trim(),
      status: "open",
    },
  });
}

export type PurchaseInput = {
  noGift: boolean;
  title: string;
  price: string;
  store: string;
  link: string;
  imageUrl?: string;
  purchasedOn: string;
  note: string;
  /** Occurrence the form was showing. A repeat submit for this date does not roll forward. */
  occurrenceOn?: string;
};

async function latestPurchase(occasionId: string) {
  return prisma.purchase.findFirst({
    where: { occasionId },
    orderBy: { createdAt: "desc" },
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type PurchaseReader = Prisma.TransactionClient | typeof prisma;

/** Keyed rows match the unique index. Legacy null keys match only their own occurrence date. */
async function findPurchaseForOccurrence(db: PurchaseReader, occasionId: string, occurrenceKey: string) {
  const keyed = await db.purchase.findUnique({
    where: { occasionId_occurrenceKey: { occasionId, occurrenceKey } },
  });
  if (keyed) return keyed;
  const legacy = await db.purchase.findMany({
    where: { occasionId, occurrenceKey: null },
    orderBy: { createdAt: "asc" },
  });
  return legacy.find((row) => storedPurchaseOccurrenceKey(row) === occurrenceKey) ?? null;
}

export async function completeOccasion(occasionId: string, input: PurchaseInput, now = new Date()) {
  const owner = await getOwner();
  const occasion = await prisma.occasion.findFirst({
    where: { id: occasionId, person: { userId: owner.id } },
    include: { person: true },
  });
  if (!occasion) throw new NotFoundError("That occasion is not on your list.");

  const today = ownerToday(now);
  const recurring = recursYearly(occasion.kind, occasion.recurring);
  const active = occasion.date ? activeOccurrence(occasion.date, today, occasion.lastCompletedOn, recurring) : null;
  const target = resolveCompletionTarget(input.occurrenceOn, active);
  const occurrenceKey = occurrenceKeyFor(target);

  const existing = await findPurchaseForOccurrence(prisma, occasion.id, occurrenceKey);
  if (existing) return existing;

  if (occasion.status === "completed") {
    const prior = await latestPurchase(occasion.id);
    if (prior) return prior;
    throw new ValidationError("That occasion is already completed.");
  }

  if (!shouldAcceptNewCompletion({ lastCompletedOn: occasion.lastCompletedOn, target, today })) {
    const prior = await latestPurchase(occasion.id);
    if (prior) return prior;
    throw new ValidationError("That occurrence is already complete.");
  }

  if (occurrenceKey !== occurrenceKeyFor(active)) {
    throw new ValidationError("That occurrence is not open for completion.");
  }

  let title = "";
  let priceCents: number | null = null;
  let store = "";
  let link = "";
  let imageUrl = "";
  if (!input.noGift) {
    title = input.title.trim();
    if (!title) throw new ValidationError("Name what you bought, or mark it as no gift.");
    const price = input.price.trim();
    if (!/^\d+(\.\d+)?$/.test(price)) {
      throw new ValidationError("Enter the price paid as a number, like 36 or 36.50.");
    }
    priceCents = dollarsToCents(price);
    if (priceCents < 0) throw new ValidationError("Price paid cannot be negative.");
    store = displayStore(input.store);
    link = parsePurchaseLink(input.link);
    imageUrl = safeImageUrl(input.imageUrl);
  }

  const purchasedOn = input.purchasedOn.trim() ? parseDateInput(input.purchasedOn) : today;
  if (!purchasedOn) throw new ValidationError("That purchase date is not a real calendar day.");

  try {
    return await prisma.$transaction(async (tx) => {
      const again = await findPurchaseForOccurrence(tx, occasion.id, occurrenceKey);
      if (again) return again;
      const purchase = await tx.purchase.create({
        data: {
          personId: occasion.personId,
          occasionId: occasion.id,
          occasionTitle: occasion.title,
          occasionKind: occasion.kind,
          occurrenceOn: target,
          occurrenceKey,
          noGift: input.noGift,
          title,
          priceCents,
          store,
          link,
          imageUrl,
          purchasedOn,
          note: input.note.trim(),
        },
      });
      await tx.occasion.update({
        where: { id: occasion.id },
        data: recurring
          ? { status: "open", lastCompletedOn: target }
          : { status: "completed", lastCompletedOn: target },
      });
      return purchase;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const prior = await prisma.purchase.findUnique({
      where: { occasionId_occurrenceKey: { occasionId: occasion.id, occurrenceKey } },
    });
    if (prior) return prior;
    throw error;
  }
}

export async function setDealState(personId: string, productKey: string, state: "favorite" | "dismissed") {
  await requirePerson(personId);
  return prisma.savedDeal.upsert({
    where: { personId_productKey: { personId, productKey } },
    update: { state },
    create: { personId, productKey, state },
  });
}
