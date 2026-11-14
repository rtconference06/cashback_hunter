import { parseHttpUrl } from "@/lib/links";
import { parseList } from "@/lib/lists";

export class ValidationError extends Error {
  readonly field?: "email";

  constructor(message: string, field?: "email") {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export const OCCASION_KINDS = [
  "birthday",
  "anniversary",
  "teachers_day",
  "holiday",
  "custom",
  "adhoc",
] as const;

export type OccasionKind = (typeof OCCASION_KINDS)[number];

export function occasionKindLabel(kind: string): string {
  switch (kind) {
    case "birthday":
      return "Birthday";
    case "anniversary":
      return "Anniversary";
    case "teachers_day":
      return "Teachers' Day";
    case "holiday":
      return "Holiday";
    case "custom":
      return "Custom event";
    case "adhoc":
      return "Need to buy something";
    default:
      return kind;
  }
}

export type PersonInput = {
  name: string;
  relationship: string;
  email?: string;
  likes: string;
  dislikes: string;
  hobbies: string;
  budget: string;
  notes?: string;
};

export type ParsedPerson = {
  name: string;
  relationship: string;
  email: string;
  likes: string[];
  dislikes: string[];
  hobbies: string[];
  budgetCents: number;
  notes: string;
};

/** Empty is allowed. A non-empty value must look like an email address. */
export function parseEmail(input: string | undefined): string {
  const email = (input ?? "").trim();
  if (!email) return "";
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
    throw new ValidationError("Enter a valid email address, or leave it blank.", "email");
  }
  return email;
}

export function parsePerson(input: PersonInput): ParsedPerson {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Name is required.");

  const relationship = input.relationship.trim();
  if (!relationship) throw new ValidationError("Relationship is required.");

  const budget = parseBudget(input.budget);
  const email = parseEmail(input.email);

  return {
    name,
    relationship,
    email,
    likes: parseList(input.likes),
    dislikes: parseList(input.dislikes),
    hobbies: parseList(input.hobbies),
    budgetCents: budget,
    notes: (input.notes ?? "").trim(),
  };
}

/** Dollars as typed into the form. Rejects a blank, text, and negative amounts. */
export function parseBudget(input: string): number {
  const trimmed = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new ValidationError("Enter a numeric budget in dollars, like 40 or 40.50.");
  }
  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) {
    throw new ValidationError("Enter a numeric budget in dollars, like 40 or 40.50.");
  }
  if (amount < 0) throw new ValidationError("Budget cannot be negative.");
  return Math.round(amount * 100);
}

export function parseOptionalBudget(input: string): number | null {
  if (!input.trim()) return null;
  return parseBudget(input);
}

/** Empty stays empty. Anything else must be an absolute http(s) URL with a host. */
export function parsePurchaseLink(input: string | undefined): string {
  const link = (input ?? "").trim();
  if (!link) return "";
  if (!parseHttpUrl(link)) {
    throw new ValidationError("Enter a full http or https link, or leave it blank.");
  }
  return link;
}
