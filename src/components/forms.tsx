"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  adhocSearchAction,
  checkUpcomingAction,
  completeOccasionAction,
  createOccasionAction,
  createPersonAction,
  searchAction,
  updatePersonAction,
  type ActionState,
} from "@/app/actions";
import { centsToDollarInput, formatMoney, formatPercent } from "@/lib/money";
import type { DealView } from "@/lib/deals";
import { Button, Field, Input, Textarea } from "@/components/ui";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
}: {
  children: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

function Banner({ state }: { state: ActionState }) {
  if (!state?.error && !state?.notice) return null;
  if (state.error) {
    return (
      <p role="alert" className="rounded-xl bg-clay px-3 py-2 text-sm text-ink">
        {state.error}
      </p>
    );
  }
  return (
    <p role="status" className="rounded-xl bg-moss px-3 py-2 text-sm text-forest">
      {state.notice}
    </p>
  );
}

export function PersonForm({
  personId,
  defaults,
  submitLabel,
  initialState = null,
}: {
  personId?: string;
  defaults?: {
    name: string;
    relationship: string;
    email: string;
    likes: string;
    dislikes: string;
    hobbies: string;
    budget: string;
    notes: string;
  };
  submitLabel: string;
  initialState?: ActionState;
}) {
  const action = personId ? updatePersonAction.bind(null, personId) : createPersonAction;
  const [state, formAction] = useActionState(action, initialState ?? null);
  const emailError = state?.fieldErrors?.email;
  return (
    <form action={formAction} className="grid gap-4">
      <Banner state={state} />
      <Field label="Name">
        <Input name="name" defaultValue={defaults?.name} required autoComplete="name" />
      </Field>
      <Field label="Relationship" hint="Family, friend, teacher, neighbor.">
        <Input name="relationship" defaultValue={defaults?.relationship} list="relationships" required />
        <datalist id="relationships">
          <option value="Family" />
          <option value="Friend" />
          <option value="Teacher" />
          <option value="Coworker" />
          <option value="Neighbor" />
        </datalist>
      </Field>
      <Field
        label="Email"
        hint="Optional. Kept for your reference. Digests still go to you, not to them."
        error={emailError}
        errorId="person-email-error"
      >
        <Input
          id="person-email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          defaultValue={defaults?.email}
          placeholder="maya@example.com"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "person-email-error" : undefined}
        />
      </Field>
      <Field label="Likes" hint="Comma-separated. These become the gift search.">
        <Textarea name="likes" defaultValue={defaults?.likes} />
      </Field>
      <Field label="Dislikes" hint="Comma-separated. Matched against a deal's title and category.">
        <Textarea name="dislikes" defaultValue={defaults?.dislikes} />
      </Field>
      <Field label="Hobbies" hint="Comma-separated.">
        <Textarea name="hobbies" defaultValue={defaults?.hobbies} />
      </Field>
      <Field label="Budget (USD)" hint="The most you'll pay after Rakuten cashback.">
        <Input name="budget" defaultValue={defaults?.budget} inputMode="decimal" placeholder="40" required />
      </Field>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={defaults?.notes} />
      </Field>
      <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}

export function OccasionForm({ personId }: { personId: string }) {
  const action = createOccasionAction.bind(null, personId);
  const [state, formAction] = useActionState(action, null);
  const [kind, setKind] = useState("birthday");
  const adhoc = kind === "adhoc";
  return (
    <form action={formAction} className="grid gap-4">
      <Banner state={state} />
      <Field label="Type">
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
        >
          <option value="birthday">Birthday</option>
          <option value="anniversary">Anniversary</option>
          <option value="teachers_day">Teachers&apos; Day</option>
          <option value="holiday">Holiday</option>
          <option value="custom">Custom event</option>
          <option value="adhoc">Need to buy something</option>
        </select>
      </Field>
      <Field label={adhoc ? "What do you need to buy?" : "Name"}>
        <Input name="title" placeholder={adhoc ? "Winter boots, size 1" : "Birthday"} required />
      </Field>
      <Field label={adhoc ? "Deadline (optional)" : "Date"} hint={adhoc ? "Leave blank if it's whenever." : "Birthdays, anniversaries, Teachers' Day, and holidays repeat every year."}>
        <Input name="date" type="date" required={!adhoc} />
      </Field>
      {kind === "custom" ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="recurring" className="h-4 w-4 accent-forest" />
          Repeats yearly
        </label>
      ) : null}
      <Field label="Budget override (optional)" hint="Leave blank to use their usual budget.">
        <Input name="budget" inputMode="decimal" placeholder="35" />
      </Field>
      <Field label="Notes">
        <Textarea name="notes" />
      </Field>
      <SubmitButton pendingLabel="Adding…" variant="secondary">
        Add occasion
      </SubmitButton>
    </form>
  );
}

export function AdhocSearchForm({ personId }: { personId: string }) {
  const action = adhocSearchAction.bind(null, personId);
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-3 rounded-2xl border border-line bg-card p-4">
      <Banner state={state} />
      <Field label="Need it now" hint="One search, using their budget and dislikes.">
        <Input name="need" placeholder="Winter boots" required />
      </Field>
      <Field label="Deadline (optional)">
        <Input name="deadline" type="date" />
      </Field>
      <SubmitButton pendingLabel="Searching…">Search this need</SubmitButton>
    </form>
  );
}

export function GiftSearchForm({
  personId,
  occasions,
}: {
  personId: string;
  occasions: { id: string; title: string; kind: string }[];
}) {
  const [state, formAction] = useActionState(searchAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="personId" value={personId} />
      <label className="grid flex-1 gap-1.5 text-sm font-medium">
        Search for
        <select name="occasionId" className="h-11 rounded-xl border border-line bg-card px-3 text-sm font-normal">
          <option value="">A general gift from their likes and hobbies</option>
          {occasions.map((occasion) => (
            <option key={occasion.id} value={occasion.id}>
              {occasion.title}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton pendingLabel="Searching…">Find deals</SubmitButton>
      <div className="sm:col-span-2">
        <Banner state={state} />
      </div>
    </form>
  );
}

export function UpcomingCheck() {
  const [state, formAction] = useActionState(checkUpcomingAction, null);
  return (
    <form action={formAction} className="grid gap-2">
      <SubmitButton pendingLabel="Checking…" variant="secondary">
        Send due digests
      </SubmitButton>
      <Banner state={state} />
    </form>
  );
}

export function CompleteForm({
  personId,
  occasionId,
  occurrenceOn,
  deals,
  today,
  initialState = null,
}: {
  personId: string;
  occasionId: string;
  occurrenceOn: string;
  deals: DealView[];
  today: string;
  initialState?: ActionState;
}) {
  const action = completeOccasionAction.bind(null, occasionId, personId);
  const [state, formAction] = useActionState(action, initialState);
  const [mode, setMode] = useState<"deal" | "hand" | "none">(deals.length ? "deal" : "hand");
  const [link, setLink] = useState(deals[0]?.link ?? "");
  const selected = useMemo(() => deals.find((deal) => deal.link === link) ?? null, [deals, link]);
  const prefill = mode === "deal" && selected ? selected : null;

  if (state?.notice) {
    return (
      <p role="status" className="mt-3 text-sm text-forest">
        {state.notice}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 grid gap-3 border-t border-line pt-3">
      <Banner state={state} />
      <input type="hidden" name="occurrenceOn" value={occurrenceOn} />
      <div className="flex flex-wrap gap-2 text-sm">
        {deals.length > 0 ? (
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "deal"} onChange={() => setMode("deal")} />
            Pick a suggested deal
          </label>
        ) : null}
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === "hand"} onChange={() => setMode("hand")} />
          Enter it by hand
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" checked={mode === "none"} onChange={() => setMode("none")} />
          No gift
        </label>
      </div>
      <input type="hidden" name="noGift" value={mode === "none" ? "yes" : ""} />
      <input type="hidden" name="imageUrl" value={prefill?.imageUrl ?? ""} />
      {mode === "deal" && deals.length > 0 ? (
        <label className="grid gap-1 text-sm">
          Suggested deal
          <select
            value={link}
            onChange={(event) => setLink(event.target.value)}
            className="h-11 rounded-xl border border-line bg-card px-3"
          >
            {deals.map((deal) => (
              <option key={deal.link} value={deal.link}>
                {deal.title} · {deal.store} · {formatMoney(deal.effectivePriceCents)} after {formatPercent(deal.cashbackPercent)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {mode === "none" ? (
        <p className="text-sm text-muted">This closes the occasion without a purchase. Yearly dates still roll forward.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What you bought">
            <Input name="title" key={`title-${prefill?.link ?? mode}`} defaultValue={prefill?.title ?? ""} required />
          </Field>
          <Field label="Price paid (USD)">
            <Input
              name="price"
              key={`price-${prefill?.link ?? mode}`}
              defaultValue={prefill ? centsToDollarInput(prefill.effectivePriceCents) : ""}
              inputMode="decimal"
              required
            />
          </Field>
          <Field label="Store">
            <Input name="store" key={`store-${prefill?.link ?? mode}`} defaultValue={prefill?.store ?? ""} />
          </Field>
          <Field label="Link">
            <Input name="link" key={`link-${prefill?.link ?? mode}`} defaultValue={prefill?.link ?? ""} />
          </Field>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <Input name="purchasedOn" type="date" defaultValue={today} />
        </Field>
        <Field label="Note (optional)">
          <Input name="note" placeholder="Size 1, navy" />
        </Field>
      </div>
      <SubmitButton pendingLabel="Saving…" variant="secondary">
        Mark complete
      </SubmitButton>
    </form>
  );
}
