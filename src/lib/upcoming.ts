import {
  activeOccurrence,
  daysRemainingLabel,
  daysUntil,
  recursYearly,
  type OccasionTiming,
} from "@/lib/dates";

export type UpcomingOccasion = OccasionTiming & {
  id: string;
  title: string;
  budgetCents: number | null;
};

export type UpcomingPerson = {
  id: string;
  name: string;
  relationship: string;
  hobbies: string[];
  archivedAt: Date | null;
  defaultBudgetCents: number;
  occasions: UpcomingOccasion[];
};

export type UpcomingRow = {
  personId: string;
  personName: string;
  relationship: string;
  hobbies: string[];
  occasionId: string;
  title: string;
  kind: string;
  occurrence: Date | null;
  days: number | null;
  label: string;
  budgetCents: number;
};

export function projectOccasion(occasion: UpcomingOccasion, today: Date): Omit<
  UpcomingRow,
  "personId" | "personName" | "relationship" | "hobbies"
> | null {
  if (occasion.status !== "open") return null;
  const recurring = recursYearly(occasion.kind, occasion.recurring);
  if (!occasion.date) {
    return {
      occasionId: occasion.id,
      title: occasion.title,
      kind: occasion.kind,
      occurrence: null,
      days: null,
      label: daysRemainingLabel(null, occasion.kind),
      budgetCents: occasion.budgetCents ?? 0,
    };
  }
  const occurrence = activeOccurrence(occasion.date, today, occasion.lastCompletedOn ?? null, recurring);
  const days = daysUntil(occurrence, today);
  return {
    occasionId: occasion.id,
    title: occasion.title,
    kind: occasion.kind,
    occurrence,
    days,
    label: daysRemainingLabel(days, occasion.kind),
    budgetCents: occasion.budgetCents ?? 0,
  };
}

export function sortUpcoming(rows: UpcomingRow[], today: Date): UpcomingRow[] {
  return [...rows].sort((a, b) => {
    const at = a.occurrence?.getTime() ?? today.getTime();
    const bt = b.occurrence?.getTime() ?? today.getTime();
    if (at !== bt) return at - bt;
    const byName = a.personName.localeCompare(b.personName);
    if (byName !== 0) return byName;
    return a.title.localeCompare(b.title);
  });
}

export function upcomingForPeople(people: UpcomingPerson[], today: Date): UpcomingRow[] {
  const rows: UpcomingRow[] = [];
  for (const person of people) {
    if (person.archivedAt) continue;
    for (const occasion of person.occasions) {
      const projected = projectOccasion(occasion, today);
      if (!projected) continue;
      rows.push({
        personId: person.id,
        personName: person.name,
        relationship: person.relationship,
        hobbies: person.hobbies,
        ...projected,
        budgetCents: projected.budgetCents > 0 ? projected.budgetCents : person.defaultBudgetCents,
      });
    }
  }
  return sortUpcoming(rows, today);
}

export function nextOccasionForPerson(rows: UpcomingRow[], personId: string): UpcomingRow | null {
  return rows.find((row) => row.personId === personId) ?? null;
}
