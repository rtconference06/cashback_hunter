import { mockProvider } from "@/lib/providers/mock";
import { hasRakutenCredentials, RakutenDealProvider } from "@/lib/providers/rakuten";
import type { DealProvider, ProviderEnv } from "@/lib/providers/types";

export type { DealProvider, ProviderEnv };

export const MOCK_FALLBACK_LOG =
  "[gift-hunter] Rakuten credentials are not set. Falling back to the mock deal provider.";

export function selectDealProvider(
  env: ProviderEnv = process.env,
  log: (message: string) => void = console.info,
  fetchImpl: typeof fetch = fetch,
): DealProvider {
  if (hasRakutenCredentials(env)) return new RakutenDealProvider(fetchImpl, env);
  log(MOCK_FALLBACK_LOG);
  return mockProvider;
}

export { mockProvider, hasRakutenCredentials, RakutenDealProvider };
