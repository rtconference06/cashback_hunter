import type { DealCandidate } from "@/lib/deals";
import type { SearchPlan } from "@/lib/plan";

export interface DealProvider {
  readonly name: string;
  search(plan: SearchPlan): Promise<DealCandidate[]>;
}

export type ProviderEnv = {
  [key: string]: string | undefined;
  RAKUTEN_ACCESS_TOKEN?: string;
  RAKUTEN_CLIENT_ID?: string;
  RAKUTEN_CLIENT_SECRET?: string;
  RAKUTEN_ACCOUNT_ID?: string;
  RAKUTEN_USERNAME?: string;
  RAKUTEN_PASSWORD?: string;
  RAKUTEN_TOKEN_AUTH?: string;
  RAKUTEN_TOKEN_URL?: string;
  RAKUTEN_SEARCH_URL?: string;
  RAKUTEN_MID?: string;
  RAKUTEN_MAX?: string;
};
