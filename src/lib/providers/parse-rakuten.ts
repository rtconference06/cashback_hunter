import { XMLParser } from "fast-xml-parser";
import { displayStore, effectivePriceCents, type DealCandidate } from "@/lib/deals";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => name === "item",
  trimValues: true,
});

function nodeText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && node && "#text" in node) {
    const text = (node as { "#text"?: unknown })["#text"];
    return text == null ? "" : String(text);
  }
  return "";
}

function moneyToCents(node: unknown): number | null {
  const raw = nodeText(node).replace(/,/g, "").trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function percentOf(node: unknown): number {
  const raw = nodeText(node).replace(/%/g, "").trim();
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

type XmlRecord = Record<string, unknown>;

/**
 * Product Search responses are XML. Cashback is not part of the documented
 * product schema; when a feed includes a cashback element we use it, and
 * otherwise the rate is 0 so effective price equals the selling price.
 */
export function parseRakutenProducts(xml: string): DealCandidate[] {
  const parsed = parser.parse(xml) as { result?: XmlRecord };
  const result = parsed.result;
  if (!result) return [];
  const items = Array.isArray(result.item) ? (result.item as XmlRecord[]) : [];
  const deals: DealCandidate[] = [];

  for (const item of items) {
    const link = nodeText(item.linkurl).trim();
    const title = nodeText(item.productname).trim();
    if (!link || !title) continue;

    const sale = moneyToCents(item.saleprice);
    const list = moneyToCents(item.price);
    const priceCents = sale != null && sale > 0 ? sale : list;
    if (priceCents == null || priceCents <= 0) continue;

    const categoryNode = (item.category ?? {}) as XmlRecord;
    const category = [nodeText(categoryNode.primary), nodeText(categoryNode.secondary)]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" / ");

    const descriptionNode = (item.description ?? {}) as XmlRecord;
    const description = [nodeText(descriptionNode.short), nodeText(descriptionNode.long)]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");

    const cashbackPercent = percentOf(item.cashback ?? item.cashbackpercent ?? item.cashbackPercent);
    const keywords = nodeText(item.keywords).replace(/~~/g, " ");

    deals.push({
      id: nodeText(item.sku) || link,
      title,
      description,
      category,
      priceCents,
      cashbackPercent,
      store: displayStore(nodeText(item.merchantname)),
      imageUrl: nodeText(item.imageurl).trim(),
      link,
      keywords,
    });

    // Touch effective price so a malformed percent cannot sneak through later.
    effectivePriceCents(priceCents, cashbackPercent);
  }

  return deals;
}
