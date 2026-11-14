import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getPersonRoute } from "@/app/api/people/[id]/route";
import { POST as searchRoute } from "@/app/api/people/[id]/search/route";
import { GET as listPeopleRoute } from "@/app/api/people/route";
import { prisma } from "@/lib/db";
import {
  activeOccurrence,
  daysRemainingLabel,
  occurrenceInYear,
} from "@/lib/dates";
import {
  displayStore,
  effectivePriceCents,
  maxDealsFromEnv,
  NO_MATCHES_WITHIN_BUDGET,
  rankDeals,
  UNKNOWN_STORE,
  type DealCandidate,
} from "@/lib/deals";
import { runUpcomingDigests } from "@/lib/digest-service";
import { formatLoggedEmail, renderDigest } from "@/lib/email";
import {
  archivePerson,
  completeOccasion,
  createOccasion,
  createPerson,
  getPerson,
  listPeople,
  listUpcoming,
  restorePerson,
  updatePerson,
} from "@/lib/people";
import { MOCK_FALLBACK_LOG, selectDealProvider } from "@/lib/providers";
import { clearRakutenTokenCache } from "@/lib/providers/rakuten";
import { parseRakutenProducts } from "@/lib/providers/parse-rakuten";
import { runSearch } from "@/lib/search-service";
import { candidate, resetDb, validPerson } from "./helpers";

beforeEach(async () => {
  await resetDb();
  clearRakutenTokenCache();
});

describe("AC-1 person CRUD and validation", () => {
  it("creates, reads, and updates name, relationship, likes, dislikes, hobbies, and budget", async () => {
    const created = await createPerson(validPerson);
    const read = await getPerson(created.id);
    expect(read?.name).toBe("Maya Chen");
    expect(read?.relationship).toBe("Sister");
    expect(read?.likes).toContain("ceramic mugs");
    expect(read?.dislikes).toContain("scented candles");
    expect(read?.hobbies).toContain("pottery");
    expect(read?.defaultBudgetCents).toBe(6000);

    const updated = await updatePerson(created.id, { ...validPerson, name: "Maya C.", budget: "55.50" });
    expect(updated.name).toBe("Maya C.");
    expect(updated.defaultBudgetCents).toBe(5550);
  });

  it("rejects a missing name", async () => {
    await expect(createPerson({ ...validPerson, name: "   " })).rejects.toThrow(/name is required/i);
  });

  it("rejects a negative budget", async () => {
    await expect(createPerson({ ...validPerson, budget: "-5" })).rejects.toThrow(/negative/i);
  });

  it("rejects a non-numeric budget", async () => {
    await expect(createPerson({ ...validPerson, budget: "abc" })).rejects.toThrow(/numeric/i);
  });
});

describe("person email", () => {
  it("stores a valid email and still sends digests to the owner", async () => {
    const now = new Date("2026-06-01T15:00:00Z");
    const person = await createPerson({ ...validPerson, likes: "pen", email: "maya.chen@example.com", budget: "50" });
    expect((await getPerson(person.id))?.email).toBe("maya.chen@example.com");

    const listed = await listPeopleRoute();
    const listBody = (await listed.json()) as { people: { id: string; email: string }[] };
    expect(listBody.people.find((item) => item.id === person.id)?.email).toBe("maya.chen@example.com");

    const detail = await getPersonRoute(new Request("http://localhost/api/people/" + person.id), {
      params: Promise.resolve({ id: person.id }),
    });
    const detailBody = (await detail.json()) as { person: { email: string } };
    expect(detailBody.person.email).toBe("maya.chen@example.com");

    await createOccasion(person.id, {
      kind: "birthday",
      title: "Birthday",
      date: "2026-06-15",
      recurring: true,
      budget: "",
      notes: "",
    });
    await runUpcomingDigests({ now, leadDays: 14, provider: penProvider() });
    const digest = await prisma.digest.findFirstOrThrow();
    expect(digest.to).toBe("owner@example.com");
    expect(digest.to).not.toBe("maya.chen@example.com");
  });

  it("allows an empty email", async () => {
    const blank = await createPerson({ ...validPerson, email: "" });
    const spaces = await createPerson({ ...validPerson, name: "Blank Two", email: "   " });
    expect((await getPerson(blank.id))?.email).toBe("");
    expect((await getPerson(spaces.id))?.email).toBe("");
  });

  it("rejects a malformed email", async () => {
    await expect(createPerson({ ...validPerson, email: "maya" })).rejects.toThrow(/valid email/i);
    await expect(createPerson({ ...validPerson, email: "maya@" })).rejects.toThrow(/valid email/i);
    await expect(createPerson({ ...validPerson, email: "maya@chen" })).rejects.toThrow(/valid email/i);
    await expect(createPerson({ ...validPerson, email: "maya chen@example.com" })).rejects.toThrow(/valid email/i);
    expect(await prisma.person.count()).toBe(0);
  });
});

describe("AC-2 occasion types", () => {
  it("stores birthday, anniversary, teachers_day, holiday, and adhoc with an optional deadline", async () => {
    const person = await createPerson(validPerson);
    const dated = [
      ["birthday", "Birthday", "2026-12-02"],
      ["anniversary", "Anniversary", "2026-08-18"],
      ["teachers_day", "Teachers' Day", "2026-11-20"],
      ["holiday", "Hanukkah", "2026-12-15"],
    ] as const;
    for (const [kind, title, date] of dated) {
      const occasion = await createOccasion(person.id, {
        kind,
        title,
        date,
        recurring: false,
        budget: "",
        notes: "",
      });
      expect(occasion.kind).toBe(kind);
      expect(occasion.recurring).toBe(true);
    }
    const openNeed = await createOccasion(person.id, {
      kind: "adhoc",
      title: "Winter boots",
      date: "",
      recurring: true,
      budget: "",
      notes: "Size 1",
    });
    expect(openNeed.kind).toBe("adhoc");
    expect(openNeed.date).toBeNull();
    expect(openNeed.recurring).toBe(false);
    const datedNeed = await createOccasion(person.id, {
      kind: "adhoc",
      title: "Science fair board",
      date: "2026-12-01",
      recurring: false,
      budget: "25",
      notes: "",
    });
    expect(datedNeed.date?.toISOString().slice(0, 10)).toBe("2026-12-01");
    expect(datedNeed.budgetCents).toBe(2500);
  });
});

describe("AC-3 budget uses effective price", () => {
  it("keeps only deals whose price minus cashback is within budget", () => {
    const deals = rankDeals(
      { likes: ["mug"], dislikes: [], hobbies: [], budgetCents: 5000 },
      [
        candidate({ title: "Pricey mug", priceCents: 8000, cashbackPercent: 10, category: "Kitchen" }),
        candidate({ title: "Sale mug", priceCents: 6000, cashbackPercent: 20, category: "Kitchen" }),
      ],
    );
    expect(deals.map((deal) => deal.title)).toEqual(["Sale mug"]);
    expect(deals.every((deal) => deal.effectivePriceCents <= 5000)).toBe(true);
    expect(effectivePriceCents(6000, 20)).toBe(4800);
  });
});

describe("AC-4 dislike filtering", () => {
  it("drops a decoy whose title or category matches a dislike and keeps a description-only mention", () => {
    const deals = rankDeals(
      { likes: ["mug"], dislikes: ["scented candles"], hobbies: [], budgetCents: 5000 },
      [
        candidate({ title: "Scented candle mug", category: "Kitchen", priceCents: 1500 }),
        candidate({ title: "Nice mug", category: "Scented Candles", priceCents: 1600 }),
        candidate({
          title: "Stoneware mug",
          category: "Kitchen",
          description: "People sometimes add a scented candle. This is just a mug.",
          priceCents: 2000,
        }),
      ],
    );
    expect(deals.map((deal) => deal.title)).toEqual(["Stoneware mug"]);
  });
});

describe("AC-5 sort by effective price, then match score", () => {
  it("puts the lowest effective price first and uses score only as a tiebreak", () => {
    const deals = rankDeals(
      { likes: ["mug"], dislikes: [], hobbies: ["pottery"], budgetCents: 5000, limit: 5 },
      [
        candidate({ title: "Alpha mug", priceCents: 2000, category: "Kitchen" }),
        candidate({ title: "Beta pottery mug", priceCents: 2000, category: "Kitchen" }),
        candidate({ title: "Budget mug", priceCents: 500, category: "Kitchen" }),
      ],
    );
    expect(deals.map((deal) => deal.title)).toEqual(["Budget mug", "Beta pottery mug", "Alpha mug"]);
    expect(deals[1].score).toBeGreaterThan(deals[2].score);
    expect(deals[1].effectivePriceCents).toBe(deals[2].effectivePriceCents);
  });
});

describe("AC-6 empty state", () => {
  it("returns the exact no-matches message instead of throwing", async () => {
    const person = await createPerson(validPerson);
    const result = await runSearch({
      personId: person.id,
      provider: {
        name: "fake",
        async search() {
          return [candidate({ title: "Pricey mug", priceCents: 9000, category: "Kitchen", keywords: "mug" })];
        },
      },
    });
    expect(result.deals).toEqual([]);
    expect(result.message).toBe(NO_MATCHES_WITHIN_BUDGET);
    expect(NO_MATCHES_WITHIN_BUDGET).toBe("No matches within budget");
  });
});

describe("AC-7 provider selection", () => {
  it("uses the Rakuten provider only when credentials are set, otherwise logs and uses mock", () => {
    const logs: string[] = [];
    const fallback = selectDealProvider(
      { RAKUTEN_CLIENT_ID: "  ", RAKUTEN_CLIENT_SECRET: "", RAKUTEN_ACCESS_TOKEN: "" },
      (message) => logs.push(message),
    );
    expect(fallback.name).toBe("mock");
    expect(logs).toEqual([MOCK_FALLBACK_LOG]);

    const quiet: string[] = [];
    const live = selectDealProvider(
      { RAKUTEN_CLIENT_ID: "client", RAKUTEN_CLIENT_SECRET: "secret" },
      (message) => quiet.push(message),
    );
    expect(live.name).toBe("rakuten");
    expect(quiet).toEqual([]);
  });

  it("asks the Rakuten stub for a token and parses the XML results", async () => {
    const calls: { url: string; authorization: string }[] = [];
    const xml = `<?xml version="1.0"?><result><item>
      <merchantname>REI</merchantname>
      <productname>Kids Waterproof Winter Boots</productname>
      <category><primary>Kids</primary><secondary>Footwear</secondary></category>
      <price currency="USD">48.00</price>
      <cashback>25</cashback>
      <description><short>Waterproof winter boots.</short><long></long></description>
      <linkurl>https://click.linksynergy.com/boots</linkurl>
    </item></result>`;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get("authorization") ?? "" });
      if (url.includes("/token")) {
        return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      }
      return new Response(xml, { status: 200 });
    }) as typeof fetch;

    const provider = selectDealProvider(
      {
        RAKUTEN_CLIENT_ID: "client",
        RAKUTEN_CLIENT_SECRET: "secret",
        RAKUTEN_ACCOUNT_ID: "123",
        RAKUTEN_TOKEN_URL: "https://api.rakutenmarketing.com/token",
        RAKUTEN_SEARCH_URL: "https://api.rakutenmarketing.com/productsearch/1.0",
      },
      () => undefined,
      fetchImpl,
    );
    const deals = await provider.search({ queries: ["winter boots"], exclude: [], mode: "adhoc" });
    expect(calls[0].url).toContain("/token");
    expect(calls[1].authorization).toBe("Bearer tok");
    expect(deals[0]).toMatchObject({ title: "Kids Waterproof Winter Boots", store: "REI", priceCents: 4800, cashbackPercent: 25 });
  });
});

describe("AC-8 deal limit and fields", () => {
  it("returns at most five deals by default and every deal has the required fields", () => {
    const products = Array.from({ length: 6 }, (_, index) =>
      candidate({
        title: `Mug ${index}`,
        priceCents: 1000 + index * 100,
        link: `https://example.com/mug-${index}`,
        category: "Kitchen",
        cashbackPercent: 5,
        store: "Uncommon Goods",
      }),
    );
    const deals = rankDeals({ likes: ["mug"], dislikes: [], hobbies: [], budgetCents: 5000, limit: maxDealsFromEnv() }, products);
    expect(maxDealsFromEnv()).toBe(5);
    expect(deals).toHaveLength(5);
    for (const deal of deals) {
      expect(deal.title).toBeTruthy();
      expect(deal.store).toBe("Uncommon Goods");
      expect(deal.priceCents).toBeGreaterThan(0);
      expect(deal.cashbackPercent).toBe(5);
      expect(deal.effectivePriceCents).toBeLessThan(deal.priceCents);
      expect(deal.link).toMatch(/^https:\/\//);
    }
    expect(rankDeals({ likes: ["mug"], dislikes: [], hobbies: [], budgetCents: 5000, limit: maxDealsFromEnv({ MAX_DEALS: "2" }) }, products)).toHaveLength(2);
  });
});

describe("AC-9 digest window and same-day dedupe", () => {
  it("sends 14 days ahead, skips 15 days, and does not duplicate on a second run the same day", async () => {
    const now = new Date("2026-06-01T15:00:00Z");
    const person = await createPerson({ ...validPerson, likes: "pen", budget: "50" });
    await createOccasion(person.id, { kind: "birthday", title: "Birthday", date: "2026-06-15", recurring: true, budget: "", notes: "" });
    await createOccasion(person.id, { kind: "holiday", title: "Flag Day", date: "2026-06-16", recurring: true, budget: "", notes: "" });
    const provider = penProvider();
    await runUpcomingDigests({ now, leadDays: 14, provider });
    await runUpcomingDigests({ now, leadDays: 14, provider });
    const digests = await prisma.digest.findMany();
    expect(digests).toHaveLength(1);
    expect(digests[0].subject).toContain("Birthday");
  });

  it("honors a shorter lead window", async () => {
    const now = new Date("2026-06-01T15:00:00Z");
    const person = await createPerson({ ...validPerson, likes: "pen", budget: "50" });
    await createOccasion(person.id, { kind: "birthday", title: "Birthday", date: "2026-06-11", recurring: true, budget: "", notes: "" });
    await runUpcomingDigests({ now, leadDays: 7, provider: penProvider() });
    expect(await prisma.digest.count()).toBe(0);
    await runUpcomingDigests({ now, leadDays: 10, provider: penProvider() });
    expect(await prisma.digest.count()).toBe(1);
  });
});

describe("AC-10 logged email", () => {
  it("logs recipient, subject, and body when email is not configured", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const now = new Date("2026-06-01T15:00:00Z");
    const person = await createPerson({ ...validPerson, likes: "pen", budget: "50" });
    await createOccasion(person.id, { kind: "birthday", title: "Birthday", date: "2026-06-15", recurring: true, budget: "", notes: "" });
    await runUpcomingDigests({ now, leadDays: 14, provider: penProvider() });
    const logged = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("To: owner@example.com");
    expect(logged).toContain("Subject: Cashback Hunter: Maya Chen — Birthday");
    expect(logged).toContain("Brass pen");
    expect(logged).toContain("Store: JetPens");
    const saved = await prisma.digest.findFirstOrThrow();
    expect(saved.to).toBe("owner@example.com");
    expect(saved.subject).toContain("Birthday");
    expect(saved.bodyText).toContain("Brass pen");
    expect(saved.status).toBe("logged");
    spy.mockRestore();
  });
});

describe("AC-11 ad-hoc search in one request", () => {
  it("returns budget-respecting deals for a need in a single response", async () => {
    const person = await createPerson({
      ...validPerson,
      likes: "dinosaurs, drawing",
      dislikes: "candy",
      hobbies: "drawing",
      budget: "40",
    });
    const response = await searchRoute(
      new Request("http://localhost/api/people/id/search", {
        method: "POST",
        body: JSON.stringify({ need: "Winter boots" }),
      }),
      { params: Promise.resolve({ id: person.id }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { deals: { title: string; effectivePriceCents: number; store: string }[]; message: string | null };
    expect(body.deals.length).toBeGreaterThan(0);
    expect(body.deals.every((deal) => deal.effectivePriceCents <= 4000)).toBe(true);
    expect(body.deals.map((deal) => deal.title)).toContain("Kids Waterproof Winter Boots");
    expect(body.deals.map((deal) => deal.title)).not.toContain("Deluxe Kids Winter Boots");
    expect(body.deals.every((deal) => deal.store.trim().length > 0)).toBe(true);
    expect(body.message).toBeNull();
  });
});

describe("AC-12 dismissed deals and favorites", () => {
  it("hides dismissed deals and pins favorites above a cheaper match", () => {
    const cheap = candidate({ title: "Cheap mug", priceCents: 1000, link: "https://example.com/cheap", category: "Kitchen" });
    const pricey = candidate({ title: "Pricey mug", priceCents: 3000, link: "https://example.com/pricey", category: "Kitchen" });
    const input = { likes: ["mug"], dislikes: [] as string[], hobbies: [] as string[], budgetCents: 5000, limit: 5 };
    const hidden = rankDeals({ ...input, saved: [{ productKey: cheap.link, state: "dismissed" }] }, [cheap, pricey]);
    expect(hidden.map((deal) => deal.title)).toEqual(["Pricey mug"]);
    const pinned = rankDeals({ ...input, saved: [{ productKey: pricey.link, state: "favorite" }] }, [cheap, pricey]);
    expect(pinned[0]).toMatchObject({ title: "Pricey mug", favorite: true });
  });
});

describe("AC-13 secrets stay in the environment", () => {
  it("does not commit credentials and reads Rakuten settings only from env", () => {
    const gitignore = readFileSync(".gitignore", "utf8");
    expect(gitignore).toMatch(/\.env\*/);
    const example = readFileSync(".env.example", "utf8");
    expect(example).toContain('RAKUTEN_CLIENT_SECRET=""');
    expect(example).toContain('RESEND_API_KEY=""');
    expect(example).not.toMatch(/RAKUTEN_CLIENT_SECRET="[^"]+/);
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const source = readFileSync(file, "utf8");
      if (/RAKUTEN_CLIENT_SECRET\s*=\s*["'][^"']+["']/.test(source)) offenders.push(file);
      if (/RESEND_API_KEY\s*=\s*["'][^"']+["']/.test(source)) offenders.push(file);
      if (/SMTP_PASS\s*=\s*["'][^"']+["']/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("AC-14 recording a purchase", () => {
  it("records a suggested deal and a hand-entered purchase", async () => {
    const now = new Date("2026-11-14T12:00:00Z");
    const person = await createPerson(validPerson);
    const birthday = await createOccasion(person.id, {
      kind: "birthday",
      title: "Birthday",
      date: "2026-12-02",
      recurring: true,
      budget: "",
      notes: "",
    });
    const holiday = await createOccasion(person.id, {
      kind: "holiday",
      title: "Hanukkah",
      date: "2026-12-15",
      recurring: true,
      budget: "",
      notes: "",
    });
    const fromDeal = await completeOccasion(
      birthday.id,
      {
        noGift: false,
        title: "Handmade Ceramic Mug",
        price: "30.60",
        store: "Uncommon Goods",
        link: "https://www.rakuten.com/#sample-ceramic-mug",
        purchasedOn: "2026-11-01",
        note: "Picked from the suggested deals",
      },
      now,
    );
    const byHand = await completeOccasion(
      holiday.id,
      {
        noGift: false,
        title: "Navy wool coat",
        price: "42",
        store: "REI",
        link: "https://example.com/coat",
        purchasedOn: "2026-11-10",
        note: "Typed in by hand",
      },
      now,
    );
    expect(fromDeal.title).toBe("Handmade Ceramic Mug");
    expect(fromDeal.priceCents).toBe(3060);
    expect(fromDeal.store).toBe("Uncommon Goods");
    expect(byHand).toMatchObject({ title: "Navy wool coat", priceCents: 4200, store: "REI", link: "https://example.com/coat" });
  });
});

describe("AC-15 history timeline", () => {
  it("lists completed purchases newest first", async () => {
    const person = await createPerson(validPerson);
    const first = await createOccasion(person.id, { kind: "holiday", title: "Older", date: "2026-01-01", recurring: true, budget: "", notes: "" });
    const second = await createOccasion(person.id, { kind: "holiday", title: "Newer", date: "2026-02-01", recurring: true, budget: "", notes: "" });
    await completeOccasion(first.id, gift("Older pen", "10", "2026-01-02"), new Date("2026-03-01T00:00:00Z"));
    await completeOccasion(second.id, gift("Newer pen", "12", "2026-02-02"), new Date("2026-03-01T00:00:00Z"));
    const history = await getPerson(person.id);
    expect(history?.purchases.map((purchase) => purchase.title)).toEqual(["Newer pen", "Older pen"]);
    expect(history?.purchases[0].occasionTitle).toBe("Newer");
  });
});

describe("AC-16 yearly rollover", () => {
  it("moves a completed birthday to next year", async () => {
    const now = new Date("2026-07-01T12:00:00Z");
    const person = await createPerson(validPerson);
    const birthday = await createOccasion(person.id, {
      kind: "birthday",
      title: "Birthday",
      date: "2026-06-01",
      recurring: true,
      budget: "",
      notes: "",
    });
    await completeOccasion(birthday.id, gift("Pen", "20", "2026-06-01"), now);
    const row = (await listUpcoming(now)).find((item) => item.occasionId === birthday.id);
    expect(row?.occurrence?.toISOString().slice(0, 10)).toBe("2027-06-01");
    const stored = await prisma.occasion.findUniqueOrThrow({ where: { id: birthday.id } });
    expect(stored.status).toBe("open");
    expect(stored.lastCompletedOn?.toISOString().slice(0, 10)).toBe("2026-06-01");
  });
});

describe("AC-17 days remaining on a person's upcoming occasions", () => {
  it("reports Today, a day count, and overdue", async () => {
    const now = new Date("2026-11-14T12:00:00Z");
    const person = await createPerson(validPerson);
    await createOccasion(person.id, { kind: "birthday", title: "Today gift", date: "2026-11-14", recurring: true, budget: "", notes: "" });
    await createOccasion(person.id, { kind: "holiday", title: "Soon", date: "2026-11-20", recurring: true, budget: "", notes: "" });
    await createOccasion(person.id, { kind: "anniversary", title: "Late", date: "2026-11-10", recurring: true, budget: "", notes: "" });
    const labels = (await listUpcoming(now)).filter((row) => row.personId === person.id).map((row) => [row.title, row.label]);
    expect(labels).toEqual([
      ["Late", "Overdue by 4 days"],
      ["Today gift", "Today"],
      ["Soon", "6 days"],
    ]);
  });
});

describe("AC-18 upcoming occasions sorted by date", () => {
  it("orders every active member's occasions and hides archived people", async () => {
    const now = new Date("2026-11-14T12:00:00Z");
    const early = await createPerson({ ...validPerson, name: "Early Person" });
    const middle = await createPerson({ ...validPerson, name: "Middle Person" });
    const later = await createPerson({ ...validPerson, name: "Later Person" });
    const hidden = await createPerson({ ...validPerson, name: "Hidden Person" });
    await createOccasion(early.id, { kind: "birthday", title: "Overdue party", date: "2026-11-11", recurring: true, budget: "", notes: "" });
    await createOccasion(middle.id, { kind: "holiday", title: "Soon party", date: "2026-11-16", recurring: true, budget: "", notes: "" });
    await createOccasion(later.id, { kind: "anniversary", title: "Later party", date: "2026-12-04", recurring: true, budget: "", notes: "" });
    await createOccasion(hidden.id, { kind: "birthday", title: "Should not show", date: "2026-11-10", recurring: true, budget: "", notes: "" });
    await archivePerson(hidden.id);
    const titles = (await listUpcoming(now)).map((row) => row.title);
    expect(titles).toEqual(["Overdue party", "Soon party", "Later party"]);
  });
});

describe("AC-19 people list shows hobbies and the next occasion", () => {
  it("includes hobbies and the soonest open occasion", async () => {
    const now = new Date("2026-11-14T12:00:00Z");
    const person = await createPerson({ ...validPerson, hobbies: "pottery, reading" });
    await createOccasion(person.id, { kind: "holiday", title: "Far holiday", date: "2026-12-20", recurring: true, budget: "", notes: "" });
    await createOccasion(person.id, { kind: "birthday", title: "Near birthday", date: "2026-11-18", recurring: true, budget: "", notes: "" });
    const [listed] = await listPeople(now);
    expect(listed.hobbies).toEqual(["pottery", "reading"]);
    expect(listed.nextOccasion?.title).toBe("Near birthday");
    expect(listed.nextOccasion?.label).toBe("4 days");
  });
});

describe("AC-20 day labels", () => {
  it("uses Today, N days, and Overdue by N days", () => {
    expect(daysRemainingLabel(0)).toBe("Today");
    expect(daysRemainingLabel(1)).toBe("1 day");
    expect(daysRemainingLabel(6)).toBe("6 days");
    expect(daysRemainingLabel(-1)).toBe("Overdue by 1 day");
    expect(daysRemainingLabel(-4)).toBe("Overdue by 4 days");
  });
});

describe("AC-21 overdue occasions do not roll until completed", () => {
  it("keeps a missed birthday on the missed date", () => {
    const anchor = new Date(Date.UTC(1990, 5, 1));
    const today = new Date(Date.UTC(2026, 6, 1));
    const missed = activeOccurrence(anchor, today, null, true);
    expect(missed.toISOString().slice(0, 10)).toBe("2026-06-01");
    const after = activeOccurrence(anchor, today, missed, true);
    expect(after.toISOString().slice(0, 10)).toBe("2027-06-01");
    const stillOverdue = activeOccurrence(anchor, new Date(Date.UTC(2026, 7, 1)), new Date(Date.UTC(2024, 5, 1)), true);
    expect(stillOverdue.toISOString().slice(0, 10)).toBe("2025-06-01");
  });
});

describe("AC-22 February 29", () => {
  it("shows Feb 28 in non-leap years and Feb 29 in leap years", () => {
    const anchor = new Date(Date.UTC(2024, 1, 29));
    expect(occurrenceInYear(anchor, 2026).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(occurrenceInYear(anchor, 2027).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(occurrenceInYear(anchor, 2028).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(occurrenceInYear(anchor, 1900).toISOString().slice(0, 10)).toBe("1900-02-28");
    expect(occurrenceInYear(anchor, 2000).toISOString().slice(0, 10)).toBe("2000-02-29");
    const after2026 = activeOccurrence(anchor, new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 1, 28)), true);
    expect(after2026.toISOString().slice(0, 10)).toBe("2027-02-28");
    const leapAgain = activeOccurrence(anchor, new Date(Date.UTC(2028, 0, 1)), new Date(Date.UTC(2027, 1, 28)), true);
    expect(leapAgain.toISOString().slice(0, 10)).toBe("2028-02-29");
  });
});

describe("AC-23 no gift", () => {
  it("completes an occasion without an item and still rolls a birthday forward", async () => {
    const now = new Date("2026-07-01T12:00:00Z");
    const person = await createPerson(validPerson);
    const birthday = await createOccasion(person.id, {
      kind: "birthday",
      title: "Birthday",
      date: "2026-06-01",
      recurring: true,
      budget: "",
      notes: "",
    });
    const purchase = await completeOccasion(
      birthday.id,
      { noGift: true, title: "", price: "", store: "", link: "", purchasedOn: "2026-06-02", note: "We had dinner." },
      now,
    );
    expect(purchase.noGift).toBe(true);
    expect(purchase.title).toBe("");
    expect(purchase.priceCents).toBeNull();
    const row = (await listUpcoming(now)).find((item) => item.occasionId === birthday.id);
    expect(row?.occurrence?.toISOString().slice(0, 10)).toBe("2027-06-01");
  });
});

describe("AC-24 digest skips completed occasions and adhoc closes", () => {
  it("does not email a completed occasion, and an ad-hoc need stays closed", async () => {
    const now = new Date("2026-06-01T15:00:00Z");
    const person = await createPerson({ ...validPerson, likes: "pen", budget: "50" });
    const birthday = await createOccasion(person.id, {
      kind: "birthday",
      title: "Birthday",
      date: "2026-06-10",
      recurring: true,
      budget: "",
      notes: "",
    });
    await prisma.occasion.update({ where: { id: birthday.id }, data: { status: "completed" } });
    const need = await createOccasion(person.id, {
      kind: "adhoc",
      title: "Printer paper",
      date: "",
      recurring: false,
      budget: "",
      notes: "",
    });
    await completeOccasion(need.id, gift("Paper", "8", "2026-06-01"), now);
    const closed = await prisma.occasion.findUniqueOrThrow({ where: { id: need.id } });
    expect(closed.status).toBe("completed");
    expect(await listUpcoming(now)).toEqual([]);
    await runUpcomingDigests({ now, leadDays: 14, provider: penProvider() });
    expect(await prisma.digest.count()).toBe(0);
  });
});

describe("AC-25 archive and restore", () => {
  it("is idempotent, keeps history, and has no hard delete", async () => {
    const person = await createPerson(validPerson);
    const occasion = await createOccasion(person.id, {
      kind: "birthday",
      title: "Birthday",
      date: "2026-12-02",
      recurring: true,
      budget: "",
      notes: "",
    });
    await completeOccasion(occasion.id, gift("Mug", "20", "2025-12-02"), new Date("2026-01-01T00:00:00Z"));
    const first = await archivePerson(person.id);
    const second = await archivePerson(person.id);
    expect(second.archivedAt?.toISOString()).toBe(first.archivedAt?.toISOString());
    expect(await prisma.occasion.count({ where: { personId: person.id } })).toBe(1);
    expect(await prisma.purchase.count({ where: { personId: person.id } })).toBe(1);
    expect(await listPeople()).toEqual([]);

    const restored = await restorePerson(person.id);
    expect(restored.archivedAt).toBeNull();
    const again = await restorePerson(person.id);
    expect(again.archivedAt).toBeNull();
    const back = await getPerson(person.id);
    expect(back?.purchases).toHaveLength(1);
    expect(back?.purchases[0].title).toBe("Mug");
    expect(back?.occasions).toHaveLength(1);

    const offenders: string[] = [];
    for (const file of walk("src")) {
      const source = readFileSync(file, "utf8");
      if (/person\.delete\(/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("AC-26 store name", () => {
  it("shows Unknown store in rankings, parsed feeds, and the logged digest", () => {
    expect(displayStore("")).toBe(UNKNOWN_STORE);
    expect(displayStore("   ")).toBe(UNKNOWN_STORE);
    expect(displayStore(undefined)).toBe(UNKNOWN_STORE);
    expect(displayStore("REI")).toBe("REI");

    const parsed = parseRakutenProducts(`<result><item>
      <productname>Wool socks</productname>
      <price currency="USD">20.00</price>
      <linkurl>https://click.linksynergy.com/socks</linkurl>
    </item></result>`);
    expect(parsed[0].store).toBe("Unknown store");

    const ranked = rankDeals(
      { likes: ["socks"], dislikes: [], hobbies: [], budgetCents: 5000 },
      [candidate({ title: "Wool socks", priceCents: 2000, store: " ", category: "Clothing" })],
    );
    expect(ranked[0].store).toBe("Unknown store");

    const rendered = renderDigest({
      personName: "Maya Chen",
      occasionTitle: "Birthday",
      whenLabel: "14 days",
      budgetCents: 4000,
      deals: [
        {
          title: "Wool socks",
          store: "",
          priceCents: 2000,
          cashbackPercent: 0,
          effectivePriceCents: 2000,
          link: "https://example.com/socks",
          whyMatched: "Fits.",
        },
      ],
    });
    expect(rendered.text).toContain("Store: Unknown store");
    expect(rendered.html).toContain("Unknown store");
    const logged = formatLoggedEmail({
      to: "owner@example.com",
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    expect(logged).toContain("To: owner@example.com");
    expect(logged).toContain(`Subject: ${rendered.subject}`);
    expect(logged).toContain("Store: Unknown store");
  });
});

function penProvider() {
  return {
    name: "fake",
    async search(): Promise<DealCandidate[]> {
      return [
        candidate({
          title: "Brass pen",
          priceCents: 2000,
          cashbackPercent: 10,
          store: "JetPens",
          category: "Stationery",
          keywords: "pen",
          link: "https://example.com/pen",
        }),
      ];
    },
  };
}

function gift(title: string, price: string, purchasedOn: string) {
  return { noGift: false, title, price, store: "JetPens", link: "https://example.com/item", purchasedOn, note: "" };
}

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) files.push(full);
  }
  return files;
}
