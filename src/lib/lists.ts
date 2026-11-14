export function parseList(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseStoredList(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Older rows may be comma-separated.
  }
  return parseList(value);
}

export function storeList(input: string): string {
  return JSON.stringify(parseList(input));
}

/** People-list rows show this many hobbies, then "+N" for the rest. */
export const HOBBY_PREVIEW_LIMIT = 3;

export function previewHobbies(hobbies: string[], limit = HOBBY_PREVIEW_LIMIT): { shown: string[]; extra: number } {
  const clean = hobbies.map((hobby) => hobby.trim()).filter(Boolean);
  if (clean.length <= limit) return { shown: clean, extra: 0 };
  return { shown: clean.slice(0, limit), extra: clean.length - limit };
}
