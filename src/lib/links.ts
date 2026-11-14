/** Absolute http(s) URL with a host. Empty input is not a URL. */
export function parseHttpUrl(value: string | null | undefined): URL | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!/[0-9A-Za-z]/.test(url.hostname)) return null;
  return url;
}

/** Href safe to render. Non-http(s) values, including stored ones, become "". */
export function safeHttpHref(value: string | null | undefined): string {
  return parseHttpUrl(value)?.href ?? "";
}
