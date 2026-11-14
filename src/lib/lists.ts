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
