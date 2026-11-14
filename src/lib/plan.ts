const GENERIC_TITLES = new Set([
  "birthday",
  "anniversary",
  "teachers' day",
  "teachers day",
  "teacher's day",
  "holiday",
  "custom",
  "custom event",
]);

export type SearchPlan = {
  queries: string[];
  exclude: string[];
  mode: "gift" | "adhoc";
};

export function buildSearchPlan(input: {
  likes: string[];
  hobbies: string[];
  dislikes: string[];
  occasionTitle?: string | null;
  occasionNotes?: string | null;
  mode: "gift" | "adhoc";
}): SearchPlan {
  const exclude = input.dislikes.map((term) => term.trim()).filter(Boolean);
  if (input.mode === "adhoc") {
    const queries = [input.occasionTitle?.trim() ?? ""];
    const notes = input.occasionNotes?.trim() ?? "";
    if (notes && notes.length <= 60 && !notes.includes(".")) queries.push(notes);
    const cleaned = queries.filter(Boolean);
    if (cleaned.length === 0) cleaned.push(...input.likes.map((like) => like.trim()).filter(Boolean).slice(0, 2));
    return { queries: cleaned.slice(0, 3), exclude, mode: "adhoc" };
  }

  const title = input.occasionTitle?.trim() ?? "";
  const queries = [
    ...(title && !GENERIC_TITLES.has(title.toLowerCase()) ? [title] : []),
    ...input.likes,
    ...input.hobbies,
  ]
    .map((term) => term.trim())
    .filter(Boolean);

  const unique: string[] = [];
  for (const query of queries) {
    if (!unique.some((existing) => existing.toLowerCase() === query.toLowerCase())) unique.push(query);
  }
  return { queries: (unique.length > 0 ? unique : ["gift"]).slice(0, 4), exclude, mode: "gift" };
}
