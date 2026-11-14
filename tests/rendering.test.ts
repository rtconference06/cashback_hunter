import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DealList } from "@/components/deal-list";
import { CompleteForm, PersonForm } from "@/components/forms";
import { HistoryTimeline } from "@/components/history-timeline";
import { OccasionCompletionCard } from "@/components/occasion-completion";
import { NO_UPCOMING_OCCASIONS, PersonListMeta } from "@/components/person-list-meta";
import { PurchaseLink } from "@/components/purchase-link";
import { UpcomingList } from "@/components/upcoming-list";
import { offerCompletion } from "@/lib/completion";
import { formatDateInput, formatDayWithYear } from "@/lib/dates";
import type { DealView } from "@/lib/deals";
import { renderDigest } from "@/lib/email";
import { safeHttpHref } from "@/lib/links";
import type { UpcomingRow } from "@/lib/upcoming";

describe("upcoming rows show the calendar date", () => {
  it("renders the occurrence date beside the relative label", () => {
    const occurrence = new Date(Date.UTC(2026, 11, 2));
    const row: UpcomingRow = {
      personId: "person-1",
      personName: "Maya Chen",
      relationship: "Sister",
      hobbies: ["pottery"],
      occasionId: "occasion-1",
      title: "Birthday",
      kind: "birthday",
      occurrence,
      days: 18,
      label: "18 days",
      budgetCents: 6000,
    };
    const html = renderToStaticMarkup(createElement(UpcomingList, { rows: [row] }));
    expect(html).toContain("18 days");
    expect(html).toContain(formatDayWithYear(occurrence));
    expect(html).toContain(`dateTime="${formatDateInput(occurrence)}"`);
    expect(html).toContain("Dec 2, 2026");
  });
});

describe("people list hobbies and empty occasion", () => {
  it("shows the first three hobbies and +N for the remainder", () => {
    const html = renderToStaticMarkup(
      createElement(PersonListMeta, {
        budget: "$60",
        nextOccasion: { title: "Birthday", label: "18 days" },
        hobbies: ["pottery", "reading", "hiking", "chess", "birding"],
      }),
    );
    expect(html).toContain("pottery, reading, hiking +2");
    expect(html).not.toContain("chess");
    expect(html).not.toContain("birding");
  });

  it("shows every hobby when there is no remainder", () => {
    const html = renderToStaticMarkup(
      createElement(PersonListMeta, {
        budget: "$60",
        nextOccasion: { title: "Birthday", label: "18 days" },
        hobbies: ["pottery", "reading"],
      }),
    );
    expect(html).toContain("pottery, reading");
    expect(html).not.toContain("+");
  });

  it("says exactly No upcoming occasions when nothing is coming up", () => {
    const html = renderToStaticMarkup(
      createElement(PersonListMeta, {
        budget: "$40",
        nextOccasion: null,
        hobbies: [],
      }),
    );
    expect(html).toContain(NO_UPCOMING_OCCASIONS);
    expect(html).toContain("No upcoming occasions");
    expect(html).not.toContain("No upcoming occasions.");
    expect(html).not.toContain("No open occasion");
  });
});

describe("purchase links render only as http(s)", () => {
  it("drops javascript and other non-urls and keeps an https link", () => {
    expect(safeHttpHref("javascript:alert(1)")).toBe("");
    expect(safeHttpHref("notaurl")).toBe("");
    expect(safeHttpHref("http://")).toBe("");
    expect(safeHttpHref("https://example.com/coat")).toBe("https://example.com/coat");

    const safe = renderToStaticMarkup(createElement(PurchaseLink, { link: "https://example.com/coat" }));
    expect(safe).toContain('href="https://example.com/coat"');
    const blocked = renderToStaticMarkup(createElement(PurchaseLink, { link: "javascript:alert(1)" }));
    expect(blocked).toBe("");

    const history = renderToStaticMarkup(
      createElement(HistoryTimeline, {
        purchases: [
          historyEntry({ id: "ok", link: "https://example.com/coat", title: "Wool coat" }),
          historyEntry({ id: "bad", link: "javascript:alert(1)", title: "Bad link" }),
          historyEntry({ id: "text", link: "notaurl", title: "Not a url" }),
        ],
      }),
    );
    expect(history).toContain('href="https://example.com/coat"');
    expect(history).not.toContain("javascript:");
    expect(history).not.toContain("notaurl");
  });

  it("does not put a javascript url in a digest or deal href", () => {
    const digest = renderDigest({
      personName: "Maya Chen",
      occasionTitle: "Birthday",
      whenLabel: "14 days",
      budgetCents: 4000,
      deals: [
        {
          title: "Wool coat",
          store: "REI",
          priceCents: 4200,
          cashbackPercent: 0,
          effectivePriceCents: 4200,
          link: "javascript:alert(1)",
          whyMatched: "Fits.",
        },
        {
          title: "Wool socks",
          store: "REI",
          priceCents: 2000,
          cashbackPercent: 0,
          effectivePriceCents: 2000,
          link: "https://example.com/socks",
          whyMatched: "Fits.",
        },
      ],
    });
    expect(digest.html).not.toContain("javascript:");
    expect(digest.html).toContain('href="https://example.com/socks"');

    const deals = renderToStaticMarkup(
      createElement(DealList, {
        personId: "person-1",
        budgetCents: 5000,
        searched: true,
        sample: false,
        deals: [deal({ link: "javascript:alert(1)", title: "Bad" }), deal({ link: "https://example.com/socks", title: "Socks" })],
      }),
    );
    expect(deals).not.toContain('href="javascript:');
    expect(deals).toContain('href="https://example.com/socks"');
  });
});

describe("email field error", () => {
  it("shows the validation message beside the email field and marks the input invalid", () => {
    const message = "Enter a valid email address, or leave it blank.";
    const html = renderToStaticMarkup(
      createElement(PersonForm, {
        submitLabel: "Save person",
        initialState: { fieldErrors: { email: message } },
      }),
    );
    expect(html).toContain('name="email"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="person-email-error"');
    expect(html).toContain('id="person-email-error"');
    expect(html).toContain(message);
    expect(html.split(message).length - 1).toBe(1);
  });
});

describe("completion form is not offered again for a finished occurrence", () => {
  it("hides the form after that occurrence is saved", () => {
    const done = renderToStaticMarkup(
      createElement(OccasionCompletionCard, { title: "Birthday", detail: "Birthday · 335 days", offer: false }, "Mark complete"),
    );
    expect(done).toContain("Completed for this occurrence.");
    expect(done).not.toContain("Mark complete");

    const open = renderToStaticMarkup(
      createElement(
        CompleteForm,
        {
          personId: "person-1",
          occasionId: "occasion-1",
          occurrenceOn: "2026-12-02",
          deals: [],
          today: "2026-11-14",
          initialState: { notice: "Marked complete. The purchase is on the timeline." },
        },
      ),
    );
    expect(open).toContain("Marked complete");
    expect(open).not.toContain("Mark complete");
    expect(open).not.toContain("<form");
  });

  it("offers the form only for an occurrence that is not already done", () => {
    expect(offerCompletion({ lastCompletedOn: null, days: 18, purchased: false, leadDays: 14 })).toBe(true);
    expect(offerCompletion({ lastCompletedOn: new Date("2026-06-01T00:00:00Z"), days: 335, purchased: false, leadDays: 14 })).toBe(false);
    expect(offerCompletion({ lastCompletedOn: new Date("2026-06-01T00:00:00Z"), days: 10, purchased: false, leadDays: 14 })).toBe(true);
    expect(offerCompletion({ lastCompletedOn: new Date("2025-06-01T00:00:00Z"), days: -136, purchased: false, leadDays: 14 })).toBe(true);
    expect(offerCompletion({ lastCompletedOn: null, days: 18, purchased: true, leadDays: 14 })).toBe(false);
  });
});

function historyEntry(overrides: { id: string; link: string; title: string }) {
  return {
    id: overrides.id,
    personId: "person-1",
    personName: "Maya Chen",
    occasionTitle: "Birthday",
    occasionKind: "birthday",
    purchasedOn: new Date(Date.UTC(2026, 10, 1)),
    noGift: false,
    title: overrides.title,
    priceCents: 4200,
    store: "REI",
    link: overrides.link,
    imageUrl: "",
    note: "",
  };
}

function deal(overrides: { link: string; title: string }): DealView {
  return {
    title: overrides.title,
    store: "REI",
    priceCents: 2000,
    cashbackPercent: 0,
    effectivePriceCents: 2000,
    link: overrides.link,
    whyMatched: "Fits.",
    favorite: false,
    rank: 1,
    imageUrl: "",
  };
}
