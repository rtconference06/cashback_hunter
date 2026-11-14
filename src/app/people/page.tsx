import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageFallback } from "@/components/fallback";
import { listPeople } from "@/lib/people";

export const metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <PeopleList />
    </Suspense>
  );
}

async function PeopleList() {
  await connection();
  const people = await listPeople();
  if (people[0]) {
    redirect(`/people/${people[0].id}`);
  }
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <h1 className="text-3xl font-bold">People</h1>
      <p className="mt-2 text-sm text-[#575757]">Add the first person you buy for.</p>
      <Link href="/people/new" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#8529CD] px-4 text-sm font-semibold text-white">
        Add a person
      </Link>
    </main>
  );
}
