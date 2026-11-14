import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { PageFallback } from "@/components/fallback";
import { listPeople } from "@/lib/people";

export default function HomePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <GoToPeople />
    </Suspense>
  );
}

async function GoToPeople() {
  await connection();
  const people = await listPeople();
  if (people[0]) redirect(`/people/${people[0].id}`);
  redirect("/people");
  return null;
}
