import type { DealCandidate } from "@/lib/deals";
import type { SearchPlan } from "@/lib/plan";
import { parseRakutenProducts } from "@/lib/providers/parse-rakuten";
import type { DealProvider, ProviderEnv } from "@/lib/providers/types";

type TokenCache = { token: string; expiresAt: number; key: string };
let tokenCache: TokenCache | null = null;

export function clearRakutenTokenCache(): void {
  tokenCache = null;
}

export function hasRakutenCredentials(env: ProviderEnv): boolean {
  if (env.RAKUTEN_ACCESS_TOKEN?.trim()) return true;
  return Boolean(env.RAKUTEN_CLIENT_ID?.trim() && env.RAKUTEN_CLIENT_SECRET?.trim());
}

/**
 * Rakuten Advertising's token call authenticates the app with
 * `Authorization: Bearer base64(client_id:client_secret)` — Bearer, not Basic —
 * unless RAKUTEN_TOKEN_AUTH=basic. The publisher account id is the OAuth scope.
 * Older apps can still use the password grant via RAKUTEN_USERNAME/PASSWORD.
 */
async function fetchAccessToken(env: ProviderEnv, fetchImpl: typeof fetch): Promise<string> {
  const pasted = env.RAKUTEN_ACCESS_TOKEN?.trim();
  if (pasted) return pasted;

  const clientId = env.RAKUTEN_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.RAKUTEN_CLIENT_SECRET?.trim() ?? "";
  const cacheKey = clientId;
  if (tokenCache && tokenCache.key === cacheKey && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const tokenUrl = env.RAKUTEN_TOKEN_URL?.trim() || "https://api.rakutenmarketing.com/token";
  const body = new URLSearchParams();
  if (env.RAKUTEN_USERNAME?.trim() && env.RAKUTEN_PASSWORD?.trim()) {
    body.set("grant_type", "password");
    body.set("username", env.RAKUTEN_USERNAME.trim());
    body.set("password", env.RAKUTEN_PASSWORD.trim());
  } else {
    body.set("grant_type", "client_credentials");
  }
  if (env.RAKUTEN_ACCOUNT_ID?.trim()) body.set("scope", env.RAKUTEN_ACCOUNT_ID.trim());

  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const authorization =
    (env.RAKUTEN_TOKEN_AUTH || "bearer").toLowerCase() === "basic" ? `Basic ${encoded}` : `Bearer ${encoded}`;

  const response = await fetchImpl(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180);
    throw new Error(`Rakuten token request failed (${response.status}). ${detail}`);
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Rakuten token response did not include access_token.");
  tokenCache = {
    key: cacheKey,
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return payload.access_token;
}

export class RakutenDealProvider implements DealProvider {
  readonly name = "rakuten";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly env: ProviderEnv = process.env,
  ) {}

  async search(plan: SearchPlan): Promise<DealCandidate[]> {
    const token = await fetchAccessToken(this.env, this.fetchImpl);
    const base = this.env.RAKUTEN_SEARCH_URL?.trim() || "https://api.rakutenmarketing.com/productsearch/1.0";
    const found = new Map<string, DealCandidate>();
    const queries = plan.queries.slice(0, 4);
    const none = plan.exclude.slice(0, 5).join(" ");

    for (const query of queries) {
      const url = new URL(base);
      url.searchParams.set("keyword", query);
      url.searchParams.set("language", "en_US");
      url.searchParams.set("max", this.env.RAKUTEN_MAX?.trim() || "20");
      url.searchParams.set("pagenumber", "1");
      url.searchParams.set("sort", "retailprice");
      url.searchParams.set("sorttype", "asc");
      if (this.env.RAKUTEN_MID?.trim()) url.searchParams.set("mid", this.env.RAKUTEN_MID.trim());
      if (none) url.searchParams.set("none", none);

      const response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/xml",
        },
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 180);
        throw new Error(`Rakuten product search failed (${response.status}). ${detail}`);
      }
      for (const product of parseRakutenProducts(await response.text())) {
        found.set(product.link, product);
      }
    }

    return [...found.values()];
  }
}
