export type ProductImageMode = "photo" | "placeholder";

/** Keep http(s) and same-site paths. Drop anything that cannot be an image src. */
export function safeImageUrl(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return trimmed;
  } catch {
    return "";
  }
  return "";
}

/** Missing URL and a failed load both use the on-brand placeholder. */
export function productImageMode(src: string | null | undefined, failed: boolean): ProductImageMode {
  if (failed || !safeImageUrl(src)) return "placeholder";
  return "photo";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Email clients only load an absolute URL. A site path such as /products/mug.svg
 * has no host in the message, so it is a placeholder instead of a broken image.
 * https is required; http is accepted when a feed still serves it.
 */
export function digestImageUrl(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return trimmed;
  } catch {
    return "";
  }
  return "";
}

/** Email HTML cannot recover from a broken src, so a missing URL is a styled placeholder. */
export function digestProductImageHtml(title: string, imageUrl: string | null | undefined): string {
  const name = title.trim() || "Product";
  const safe = digestImageUrl(imageUrl);
  if (!safe) {
    const initial = escapeHtml((name.slice(0, 1) || "G").toUpperCase());
    return `<div data-product-image="placeholder" role="img" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}" style="width:120px;height:90px;background:#F6EEFB;border-radius:8px;color:#8529CD;font:700 28px Arial,sans-serif;line-height:90px;text-align:center;">${initial}</div>`;
  }
  return `<img data-product-image="photo" src="${escapeHtml(safe)}" alt="${escapeHtml(name)}" width="120" height="90" style="display:block;width:120px;height:90px;object-fit:contain;background:#F6F6F6;border-radius:8px;border:0;" />`;
}
