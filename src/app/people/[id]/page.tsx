import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { archivePersonAction, restorePersonAction } from "@/app/actions";
import { DealList } from "@/components/deal-list";
import { ProductImage } from "@/components/product-image";
import { AdhocSearchForm, CompleteForm, GiftSearchForm, OccasionForm } from "@/components/forms";
import { PageFallback } from "@/components/fallback";
import { Button } from "@/components/ui";
import {
  daysRemainingLabel,
  formatDateInput,
  formatDayWithYear,
  ownerToday,
  resolveBudgetCents,
} from "@/lib/dates";
import { dealsFromStored, maxDealsFromEnv } from "@/lib/deals";
import { parseStoredList } from "@/lib/lists";
import { formatMoney } from "@/lib/money";
import { getPerson, listPeople } from "@/lib/people";
import { projectOccasion, sortUpcoming, type UpcomingRow } from "@/lib/upcoming";
import { occasionKindLabel } from "@/lib/validation";
import { providerStatusLabel } from "@/lib/status";

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PersonScreen params={params} />
    </Suspense>
  );
}

async function PersonScreen({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();

  const today = ownerToday();
  const likes = parseStoredList(person.likes);
  const dislikes = parseStoredList(person.dislikes);
  const hobbies = parseStoredList(person.hobbies);
  const rows = sortUpcoming(
    person.occasions.flatMap((occasion) => {
      const projected = projectOccasion(
        { ...occasion, budgetCents: resolveBudgetCents(person.defaultBudgetCents, occasion.budgetCents) },
        today,
      );
      if (!projected) return [];
      const row: UpcomingRow = {
        personId: person.id,
        personName: person.name,
        relationship: person.relationship,
        hobbies,
        ...projected,
        budgetCents: resolveBudgetCents(person.defaultBudgetCents, occasion.budgetCents),
      };
      return [row];
    }),
    today,
  );
  const directory = await listPeople();
  const latest = person.searchRuns[0];
  const deals = latest ? dealsFromStored(latest.options, person.savedDeals, maxDealsFromEnv()) : [];
  const sample = (latest?.provider ?? "mock") !== "rakuten" && providerStatusLabel() !== "Rakuten Advertising";

  const nextRow = rows[0];
  const recent = person.purchases[0];

  return (
    <main className="mx-auto grid w-full max-w-[1200px] gap-6 px-5 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.14em] text-[#575757]">PEOPLE</h2>
          <Link href="/people/new" className="text-lg font-bold text-[#8529CD]" aria-label="Add a person">
            +
          </Link>
        </div>
        <ul className="grid gap-3">
          {directory.map((member) => {
            const selected = member.id === person.id;
            return (
              <li key={member.id}>
                <Link
                  href={`/people/${member.id}`}
                  className={`flex gap-3 rounded-xl border px-3 py-3 ${selected ? "border-[#8529CD] bg-[#F6EEFB]" : "border-[#DDDDDD] bg-white shadow-sm"}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#8529CD] text-sm font-bold text-white">
                    {member.name.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-[#252525]">{member.name}</span>
                    <span className="block text-xs text-[#575757]">Budget {formatMoney(member.defaultBudgetCents)}</span>
                    <span className="block text-xs text-[#575757]">
                      {member.nextOccasion ? `${member.nextOccasion.title} · ${member.nextOccasion.label}` : "No open occasion"}
                    </span>
                    {member.hobbies.length ? (
                      <span className="block text-xs text-[#575757]">hobbies {member.hobbies.join(", ")}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/people/archived" className="mt-4 inline-block text-sm font-semibold text-[#8529CD]">
          Archived
        </Link>
      </aside>
      <div>
      {person.archivedAt ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-clay px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Archived. They are hidden from lists and digests. History is unchanged.</p>
          <form action={restorePersonAction}>
            <input type="hidden" name="personId" value={person.id} />
            <Button type="submit" size="sm" variant="secondary">
              Restore
            </Button>
          </form>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#8529CD] text-xl font-bold text-white">
            {person.name.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#252525]">{person.name}</h1>
            <p className="mt-1 text-sm text-[#575757]">
              Budget {formatMoney(person.defaultBudgetCents)}
              {nextRow ? ` · ${nextRow.title}` : ""}
              {person.email ? ` · ${person.email}` : " · No email on file"}
            </p>
            <p className="text-sm text-[#575757]">{person.relationship}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/people/${person.id}/edit`} className="inline-flex h-10 items-center rounded-lg border border-[#DDDDDD] bg-white px-4 text-sm font-semibold">
            Edit
          </Link>
          {person.archivedAt ? null : (
            <form action={archivePersonAction}>
              <input type="hidden" name="personId" value={person.id} />
              <Button type="submit" variant="danger">
                Archive
              </Button>
            </form>
          )}
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-[#DDDDDD] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#8529CD]">Likes</h2>
          <ChipList items={likes} />
          <h2 className="mt-4 text-sm font-bold text-[#575757]">Dislikes</h2>
          <ChipList items={dislikes} />
        </article>
        <article className="rounded-xl border border-[#DDDDDD] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#252525]">Budget</h2>
          <p className="mt-3 text-3xl font-bold text-[#252525]">{formatMoney(person.defaultBudgetCents)}</p>
          <p className="mt-1 text-xs text-[#575757]">After cash back</p>
        </article>
        <article className="rounded-xl border border-[#DDDDDD] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-[#252525]">Upcoming occasion</h2>
          {nextRow ? (
            <>
              <p className="mt-3 text-lg font-bold">{nextRow.title}</p>
              <p className="text-sm text-[#575757]">
                {nextRow.occurrence ? formatDayWithYear(nextRow.occurrence) : "Whenever"} · {nextRow.label}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#575757]">No open occasion</p>
          )}
          {person.email ? (
            <p className="mt-3 text-sm">
              <a className="font-semibold text-[#8529CD]" href={`mailto:${person.email}`}>
                {person.email}
              </a>
            </p>
          ) : (
            <p className="mt-3 text-sm text-[#575757]">No email on file</p>
          )}
        </article>
      </section>
      {person.notes ? <p className="mt-4 text-sm text-muted">{person.notes}</p> : null}

      <section id="upcoming-person" className="mt-10">
        <h2 className="font-serif text-3xl">Upcoming</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No open occasions. Completed ad-hoc needs live in the timeline below.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {rows.map((row) => (
              <li key={row.occasionId} className="rounded-2xl border border-line bg-card px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-serif text-2xl">{row.title}</p>
                  <p className={row.days != null && row.days < 0 ? "text-sm font-medium text-persimmon" : "text-sm font-medium text-forest"}>
                    {row.label}
                  </p>
                </div>
                <p className="text-sm text-muted">
                  {occasionKindLabel(row.kind)}
                  {row.occurrence ? ` · ${formatDayWithYear(row.occurrence)}` : ""}
                  {` · ${formatMoney(row.budgetCents)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#252525]">Top deals for {person.name}</h2>
            <p className="mt-1 max-w-2xl text-sm text-[#575757]">
              Lowest price after cash back first. Up to {maxDealsFromEnv()} deals. Every card names the store.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <GiftSearchForm
            personId={person.id}
            occasions={person.occasions.filter((occasion) => occasion.status === "open").map((occasion) => ({
              id: occasion.id,
              title: occasion.title,
              kind: occasion.kind,
            }))}
          />
        </div>
        <div className="mt-4">
          <DealList
            personId={person.id}
            deals={deals}
            budgetCents={latest?.budgetCents ?? person.defaultBudgetCents}
            searched={Boolean(latest)}
            sample={sample}
          />
        </div>
      </section>

      <section className="mt-6 flex flex-col gap-2 border-t border-[#DDDDDD] pt-4 text-sm sm:flex-row sm:items-baseline sm:gap-6">
        <h2 className="font-bold text-[#252525]">Recent purchases</h2>
        {recent ? (
          <p className="text-[#575757]">
            {recent.occasionTitle}
            {recent.occurrenceOn ? ` ${recent.occurrenceOn.getUTCFullYear()}` : ""}
            {" – "}
            {recent.noGift ? "No gift" : `${recent.title} – ${recent.priceCents != null ? formatMoney(recent.priceCents) : ""} – ${recent.store || "Unknown store"}`}
            {" – Completed"}
          </p>
        ) : (
          <p className="text-[#575757]">Nothing completed yet.</p>
        )}
        <Link href="/history" className="font-semibold text-[#8529CD]">
          History
        </Link>
      </section>

      <section id="history" className="mt-12">
        <h2 className="font-serif text-3xl">History</h2>
        <p className="mt-1 text-sm text-muted">Completed occasions and what was actually bought.</p>
        {person.purchases.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">
            Nothing completed yet. Mark an occasion complete to start the timeline.
          </p>
        ) : (
          <ol className="mt-4 border-l border-line pl-5">
            {person.purchases.map((purchase) => (
              <li key={purchase.id} className="relative pb-6">
                <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-persimmon" />
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
                  {formatDayWithYear(purchase.purchasedOn)}
                  {purchase.occurrenceOn ? ` · occasion ${formatDayWithYear(purchase.occurrenceOn)}` : ""}
                </p>
                <p className="mt-1 font-serif text-2xl">
                  {purchase.occasionTitle}
                  <span className="text-muted"> · {occasionKindLabel(purchase.occasionKind)}</span>
                </p>
                {purchase.noGift ? (
                  <p className="mt-1 text-sm">No gift</p>
                ) : (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#F6F6F6]">
                      <ProductImage src={purchase.imageUrl} alt={purchase.title || "Purchase"} />
                    </div>
                    <p className="text-sm">
                      {purchase.title}
                      {purchase.priceCents != null ? ` · ${formatMoney(purchase.priceCents)}` : ""}
                      {` · Store: ${purchase.store || "Unknown store"}`}
                    </p>
                  </div>
                )}
                {purchase.link ? (
                  <a href={purchase.link} className="text-sm text-forest underline" target="_blank" rel="noreferrer">
                    {purchase.link}
                  </a>
                ) : null}
                {purchase.note ? <p className="mt-1 text-sm text-muted">{purchase.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-3xl">Add an occasion</h2>
          <div className="mt-4">
            <OccasionForm personId={person.id} />
          </div>
        </div>
        <div>
          <h2 className="font-serif text-3xl">Ad-hoc need</h2>
          <div className="mt-4">
            <AdhocSearchForm personId={person.id} />
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Mark complete</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Pick a suggested deal, type the purchase yourself, or record no gift. Yearly occasions roll to next year. An ad-hoc need closes.
        </p>
        <ul className="mt-4 grid gap-4">
          {person.occasions
            .filter((occasion) => occasion.status === "open")
            .map((occasion) => {
              const projected = projectOccasion(
                { ...occasion, budgetCents: occasion.budgetCents },
                today,
              );
              return (
                <li key={occasion.id} className="rounded-3xl border border-line bg-card p-4 sm:p-5">
                  <p className="font-serif text-2xl">{occasion.title}</p>
                  <p className="text-sm text-muted">
                    {occasionKindLabel(occasion.kind)}
                    {projected ? ` · ${projected.label}` : ` · ${daysRemainingLabel(null, occasion.kind)}`}
                  </p>
                  <CompleteForm
                    personId={person.id}
                    occasionId={occasion.id}
                    deals={latest?.occasionId === occasion.id ? deals : deals}
                    today={formatDateInput(today)}
                  />
                </li>
              );
            })}
        </ul>
      </section>
      </div>
    </main>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-[#575757]">None yet</p>;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full bg-[#F4F4F4] px-3 py-1 text-sm text-[#252525]">
          {item}
        </li>
      ))}
    </ul>
  );
}
