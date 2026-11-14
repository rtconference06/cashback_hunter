"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runUpcomingDigests, sendOccasionDigest } from "@/lib/digest-service";
import {
  archivePerson,
  completeOccasion,
  createOccasion,
  createPerson,
  restorePerson,
  setDealState,
  updatePerson,
  type OccasionInput,
  type PurchaseInput,
} from "@/lib/people";
import { NO_MATCHES_WITHIN_BUDGET } from "@/lib/deals";
import { runSearch } from "@/lib/search-service";
import { ValidationError, type PersonInput } from "@/lib/validation";

export type ActionState = { error?: string; notice?: string } | null;

function readPerson(formData: FormData): PersonInput {
  return {
    name: String(formData.get("name") ?? ""),
    relationship: String(formData.get("relationship") ?? ""),
    email: String(formData.get("email") ?? ""),
    likes: String(formData.get("likes") ?? ""),
    dislikes: String(formData.get("dislikes") ?? ""),
    hobbies: String(formData.get("hobbies") ?? ""),
    budget: String(formData.get("budget") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function readOccasion(formData: FormData): OccasionInput {
  return {
    kind: String(formData.get("kind") ?? "birthday"),
    title: String(formData.get("title") ?? ""),
    date: String(formData.get("date") ?? ""),
    recurring: formData.get("recurring") === "on" || formData.get("recurring") === "yes",
    budget: String(formData.get("budget") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function readPurchase(formData: FormData): PurchaseInput {
  return {
    noGift: String(formData.get("noGift") ?? "") === "yes",
    title: String(formData.get("title") ?? ""),
    price: String(formData.get("price") ?? ""),
    store: String(formData.get("store") ?? ""),
    link: String(formData.get("link") ?? ""),
    purchasedOn: String(formData.get("purchasedOn") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
}

export async function createPersonAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const person = await createPerson(readPerson(formData));
    revalidatePath("/");
    revalidatePath("/people");
    redirect(`/people/${person.id}`);
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

export async function updatePersonAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await updatePerson(id, readPerson(formData));
    revalidatePath(`/people/${id}`);
    revalidatePath("/people");
    revalidatePath("/");
    redirect(`/people/${id}`);
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

export async function archivePersonAction(formData: FormData) {
  const id = String(formData.get("personId") ?? "");
  await archivePerson(id);
  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath("/people/archived");
  revalidatePath(`/people/${id}`);
}

export async function restorePersonAction(formData: FormData) {
  const id = String(formData.get("personId") ?? "");
  await restorePerson(id);
  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath("/people/archived");
  revalidatePath(`/people/${id}`);
}

export async function createOccasionAction(personId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createOccasion(personId, readOccasion(formData));
    revalidatePath(`/people/${personId}`);
    revalidatePath("/");
    revalidatePath("/people");
    return { notice: "Occasion added." };
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

export async function completeOccasionAction(
  occasionId: string,
  personId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await completeOccasion(occasionId, readPurchase(formData));
    revalidatePath(`/people/${personId}`);
    revalidatePath("/");
    revalidatePath("/people");
    return { notice: "Marked complete. The purchase is on the timeline." };
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    throw error;
  }
}

export async function searchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const personId = String(formData.get("personId") ?? "");
  const occasionId = String(formData.get("occasionId") ?? "") || null;
  try {
    const result = await runSearch({ personId, occasionId });
    revalidatePath(`/people/${personId}`);
    revalidatePath("/");
    if (result.message) return { notice: result.message };
    return { notice: `Found ${result.deals.length} deal${result.deals.length === 1 ? "" : "s"}.` };
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Search failed." };
  }
}

export async function adhocSearchAction(personId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { searchAdhocNeed } = await import("@/lib/search-service");
    const result = await searchAdhocNeed(personId, {
      need: String(formData.get("need") ?? ""),
      deadline: String(formData.get("deadline") ?? "") || null,
    });
    revalidatePath(`/people/${personId}`);
    revalidatePath("/");
    if (result.message) return { notice: result.message };
    return { notice: `Found ${result.deals.length} deal${result.deals.length === 1 ? "" : "s"} for that need.` };
  } catch (error) {
    if (error instanceof ValidationError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Search failed." };
  }
}

export async function dismissDealAction(formData: FormData) {
  const personId = String(formData.get("personId") ?? "");
  await setDealState(personId, String(formData.get("link") ?? ""), "dismissed");
  revalidatePath(`/people/${personId}`);
}

export async function favoriteDealAction(formData: FormData) {
  const personId = String(formData.get("personId") ?? "");
  await setDealState(personId, String(formData.get("link") ?? ""), "favorite");
  revalidatePath(`/people/${personId}`);
}

export async function checkUpcomingAction(prev: ActionState): Promise<ActionState> {
  void prev;
  const outcomes = await runUpcomingDigests();
  revalidatePath("/");
  revalidatePath("/digests");
  const logged = outcomes.filter((item) => item.status === "logged" || item.status === "sent").length;
  const skipped = outcomes.filter((item) => item.status === "skipped").length;
  const empty = outcomes.filter((item) => item.status === "empty").length;
  if (logged === 0 && empty === 0) return { notice: "Nothing new to send. Completed and already-sent occasions were skipped." };
  const parts = [];
  if (logged) parts.push(`${logged} digest${logged === 1 ? "" : "s"} logged`);
  if (empty) parts.push(`${empty} had no matches`);
  if (skipped) parts.push(`${skipped} skipped`);
  return { notice: `${parts.join(". ")}.` };
}

export async function emailPersonDigestAction(personId: string, occasionId: string, prev: ActionState): Promise<ActionState> {
  void prev;
  if (!occasionId) return { error: "Add an open occasion before emailing a digest." };
  const result = await sendOccasionDigest({ personId, occasionId, force: true });
  revalidatePath("/digests");
  revalidatePath(`/people/${personId}`);
  revalidatePath("/");
  if (result.status === "empty") return { notice: NO_MATCHES_WITHIN_BUDGET };
  if (result.status === "failed") return { error: result.reason || "The digest could not be sent." };
  if (result.status === "logged") return { notice: "Digest logged. Read it under Digests." };
  if (result.status === "skipped") return { notice: "Nothing new to send for that occasion." };
  return { notice: "Digest sent." };
}
