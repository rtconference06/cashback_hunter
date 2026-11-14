import { daysUntil, formatDateInput, leadDaysFromEnv, parseDateInput } from "@/lib/dates";
import { ValidationError } from "@/lib/validation";

export const UNDATED_OCCURRENCE = "undated";

export function occurrenceKeyFor(occurrence: Date | null | undefined): string {
  if (!occurrence) return UNDATED_OCCURRENCE;
  return formatDateInput(occurrence);
}

export function resolveCompletionTarget(requested: string | undefined, active: Date | null): Date | null {
  const raw = (requested ?? "").trim();
  if (!raw || raw === UNDATED_OCCURRENCE) return active;
  const parsed = parseDateInput(raw);
  if (!parsed) throw new ValidationError("That occasion date is not a real calendar day.");
  return parsed;
}

/**
 * A yearly occasion stays open after completion so the next date can show on the calendar.
 * Completing it again before that next date is inside the shopping window would record a
 * second cycle. Treat that repeat as the cycle that was already saved.
 */
export function repeatOfCompletedCycle(lastCompletedOn: Date | null, days: number | null, leadDays: number): boolean {
  if (!lastCompletedOn) return false;
  if (days == null) return false;
  return days > leadDays;
}

export function offerCompletion(input: {
  lastCompletedOn: Date | null;
  days: number | null;
  purchased: boolean;
  leadDays?: number;
}): boolean {
  if (input.purchased) return false;
  return !repeatOfCompletedCycle(input.lastCompletedOn, input.days, input.leadDays ?? leadDaysFromEnv());
}

export function shouldAcceptNewCompletion(input: {
  lastCompletedOn: Date | null;
  target: Date | null;
  today: Date;
  leadDays?: number;
}): boolean {
  const days = input.target ? daysUntil(input.target, input.today) : null;
  return !repeatOfCompletedCycle(input.lastCompletedOn, days, input.leadDays ?? leadDaysFromEnv());
}
