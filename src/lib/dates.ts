const DAY_MS = 86_400_000;

export function asUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(asUtcDay(date).getTime() + days * DAY_MS);
}

/** Calendar date from an `<input type="date">` value. Invalid dates return null. */
export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDayWithYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.OWNER_TIMEZONE || "UTC",
  }).format(date);
}

/**
 * "Today" on the owner's calendar, as a UTC midnight Date.
 * Occasion dates are calendar dates, so the lead window compares those days
 * rather than instants.
 */
export function ownerToday(now = new Date()): Date {
  const timeZone = process.env.OWNER_TIMEZONE || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);
    if (!year || !month || !day) return asUtcDay(now);
    return new Date(Date.UTC(year, month - 1, day));
  } catch {
    return asUtcDay(now);
  }
}

export function leadDaysFromEnv(): number {
  const value = Number(process.env.DIGEST_LEAD_DAYS ?? 14);
  if (!Number.isFinite(value) || value < 0) return 14;
  return Math.floor(value);
}

export type OccasionTiming = {
  kind: string;
  date: Date | null;
  recurring: boolean;
  status: string;
  lastCompletedOn?: Date | null;
};

const YEARLY_KINDS = new Set(["birthday", "anniversary", "teachers_day", "holiday"]);

/** Birthdays, anniversaries, Teachers' Day, and holidays always repeat. Ad-hoc needs never do. */
export function recursYearly(kind: string, recurringFlag = false): boolean {
  if (YEARLY_KINDS.has(kind)) return true;
  if (isAdhocKind(kind)) return false;
  return recurringFlag;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Feb 29 anchors land on Feb 28 in non-leap years and Feb 29 in leap years. */
export function occurrenceInYear(anchor: Date, year: number): Date {
  const month = anchor.getUTCMonth();
  let day = anchor.getUTCDate();
  if (month === 1 && day === 29 && !isLeapYear(year)) day = 28;
  return new Date(Date.UTC(year, month, day));
}

/**
 * The occurrence the owner still has to act on.
 * A missed year stays overdue until it is marked complete; it does not skip ahead.
 */
export function activeOccurrence(
  anchor: Date,
  today: Date,
  lastCompleted: Date | null,
  recurring: boolean,
): Date {
  const day = asUtcDay(today);
  if (!recurring) return asUtcDay(anchor);
  if (!lastCompleted) return occurrenceInYear(anchor, day.getUTCFullYear());
  const completed = asUtcDay(lastCompleted);
  let year = completed.getUTCFullYear();
  let occurrence = occurrenceInYear(anchor, year);
  if (occurrence.getTime() <= completed.getTime()) {
    year += 1;
    occurrence = occurrenceInYear(anchor, year);
  }
  return occurrence;
}

export function daysUntil(occurrence: Date, today: Date): number {
  return Math.round((asUtcDay(occurrence).getTime() - asUtcDay(today).getTime()) / DAY_MS);
}

export function isAdhocKind(kind: string): boolean {
  return kind === "adhoc" || kind === "need";
}

/** Inclusive window: due today through `leadDays` days ahead. */
export function isInsideLeadWindow(daysUntilValue: number, leadDays: number): boolean {
  return daysUntilValue >= 0 && daysUntilValue <= leadDays;
}

export function isDue(occasion: OccasionTiming, today: Date, leadDays: number): boolean {
  if (occasion.status !== "open") return false;
  if (isAdhocKind(occasion.kind) && !occasion.date) return true;
  if (!occasion.date) return false;
  const recurring = recursYearly(occasion.kind, occasion.recurring);
  const occurrence = activeOccurrence(occasion.date, today, occasion.lastCompletedOn ?? null, recurring);
  return isInsideLeadWindow(daysUntil(occurrence, today), leadDays);
}

export function occurrenceKey(occasion: OccasionTiming & { id: string }, today: Date): string {
  if (occasion.status === "completed") return `completed:${occasion.id}`;
  if (!occasion.date) return `adhoc:${occasion.id}`;
  const recurring = recursYearly(occasion.kind, occasion.recurring);
  const occurrence = activeOccurrence(occasion.date, today, occasion.lastCompletedOn ?? null, recurring);
  const year = occurrence.getUTCFullYear();
  const month = String(occurrence.getUTCMonth() + 1).padStart(2, "0");
  const day = String(occurrence.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysRemainingLabel(days: number | null, kind = ""): string {
  if (days == null) return isAdhocKind(kind) || !kind ? "Now" : "Now";
  if (days === 0) return "Today";
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"}`;
  const overdue = Math.abs(days);
  return `Overdue by ${overdue} ${overdue === 1 ? "day" : "days"}`;
}

export function resolveBudgetCents(defaultBudgetCents: number, occasionBudgetCents: number | null | undefined): number {
  if (occasionBudgetCents != null && occasionBudgetCents > 0) return occasionBudgetCents;
  return defaultBudgetCents;
}
