import { parseStoredList } from "@/lib/lists";

function asList(value: string | string[]): string[] {
  return Array.isArray(value) ? value : parseStoredList(value);
}

export function toPersonJson(person: {
  id: string;
  name: string;
  relationship: string;
  email: string;
  likes: string | string[];
  dislikes: string | string[];
  hobbies: string | string[];
  defaultBudgetCents: number;
  notes: string;
}) {
  return {
    id: person.id,
    name: person.name,
    relationship: person.relationship,
    email: person.email,
    likes: asList(person.likes),
    dislikes: asList(person.dislikes),
    hobbies: asList(person.hobbies),
    budgetCents: person.defaultBudgetCents,
    notes: person.notes,
  };
}
