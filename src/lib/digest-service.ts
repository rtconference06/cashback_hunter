import { prisma } from "@/lib/db";
import {
  daysRemainingLabel,
  daysUntil,
  isDue,
  leadDaysFromEnv,
  occurrenceKey,
  ownerToday,
  recursYearly,
  activeOccurrence,
} from "@/lib/dates";
import type { DealProvider } from "@/lib/providers";
import { deliverEmail, digestRecipient, renderDigest, type DigestDeal } from "@/lib/email";
import { runSearch } from "@/lib/search-service";

export type DigestOutcome = {
  personId: string;
  occasionId: string;
  status: "logged" | "sent" | "skipped" | "empty" | "failed";
  digestId?: string;
  reason?: string;
};

export async function sendOccasionDigest(input: {
  personId: string;
  occasionId: string;
  now?: Date;
  leadDays?: number;
  provider?: DealProvider;
  force?: boolean;
}): Promise<DigestOutcome> {
  const now = input.now ?? new Date();
  const today = ownerToday(now);
  const leadDays = input.leadDays ?? leadDaysFromEnv();
  const occasion = await prisma.occasion.findFirst({
    where: { id: input.occasionId, personId: input.personId },
    include: { person: true },
  });
  if (!occasion) return { personId: input.personId, occasionId: input.occasionId, status: "skipped", reason: "missing" };
  if (occasion.person.archivedAt) {
    return { personId: occasion.personId, occasionId: occasion.id, status: "skipped", reason: "archived" };
  }
  if (occasion.status !== "open") {
    return { personId: occasion.personId, occasionId: occasion.id, status: "skipped", reason: "completed" };
  }
  if (!input.force && !isDue(occasion, today, leadDays)) {
    return { personId: occasion.personId, occasionId: occasion.id, status: "skipped", reason: "outside-window" };
  }

  const key = occurrenceKey(occasion, today);
  if (!input.force) {
    const existing = await prisma.digest.findFirst({
      where: {
        personId: occasion.personId,
        occasionId: occasion.id,
        occurrenceKey: key,
        status: { in: ["sent", "logged"] },
      },
    });
    if (existing) {
      return { personId: occasion.personId, occasionId: occasion.id, status: "skipped", reason: "already-sent" };
    }
  }

  const search = await runSearch({
    personId: occasion.personId,
    occasionId: occasion.id,
    provider: input.provider,
  });
  if (search.deals.length === 0) {
    return { personId: occasion.personId, occasionId: occasion.id, status: "empty", reason: search.message ?? undefined };
  }

  const recurring = recursYearly(occasion.kind, occasion.recurring);
  const occurrence = occasion.date
    ? activeOccurrence(occasion.date, today, occasion.lastCompletedOn, recurring)
    : null;
  const days = occurrence ? daysUntil(occurrence, today) : null;
  const when = daysRemainingLabel(days, occasion.kind);
  const deals: DigestDeal[] = search.deals.map((deal) => ({
    title: deal.title,
    store: deal.store,
    priceCents: deal.priceCents,
    cashbackPercent: deal.cashbackPercent,
    effectivePriceCents: deal.effectivePriceCents,
    link: deal.link,
    whyMatched: deal.whyMatched,
  }));
  const rendered = renderDigest({
    personName: occasion.person.name,
    occasionTitle: occasion.title,
    whenLabel: when,
    budgetCents: search.budgetCents,
    deals,
  });
  const to = digestRecipient();
  const delivery = await deliverEmail({ to, ...rendered });
  const digest = await prisma.digest.create({
    data: {
      personId: occasion.personId,
      occasionId: occasion.id,
      searchRunId: search.searchRunId,
      occurrenceKey: key,
      to,
      subject: rendered.subject,
      bodyText: rendered.text,
      bodyHtml: rendered.html,
      status: delivery.status === "failed" ? "failed" : delivery.status,
      provider: delivery.provider,
      error: delivery.error,
    },
  });
  return {
    personId: occasion.personId,
    occasionId: occasion.id,
    status: delivery.status,
    digestId: digest.id,
    reason: delivery.error || undefined,
  };
}

export async function runUpcomingDigests(options?: {
  now?: Date;
  leadDays?: number;
  provider?: DealProvider;
}): Promise<DigestOutcome[]> {
  const people = await prisma.person.findMany({
    where: { archivedAt: null },
    include: { occasions: true },
  });
  const outcomes: DigestOutcome[] = [];
  for (const person of people) {
    for (const occasion of person.occasions) {
      outcomes.push(
        await sendOccasionDigest({
          personId: person.id,
          occasionId: occasion.id,
          now: options?.now,
          leadDays: options?.leadDays,
          provider: options?.provider,
        }),
      );
    }
  }
  return outcomes;
}
