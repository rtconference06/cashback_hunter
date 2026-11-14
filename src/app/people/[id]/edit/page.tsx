import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { PersonForm } from "@/components/forms";
import { PageFallback } from "@/components/fallback";
import { centsToDollarInput } from "@/lib/money";
import { getPerson } from "@/lib/people";
import { parseStoredList } from "@/lib/lists";

export default function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-forest">Edit</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">{person.name}</h1>
      <div className="mt-8">
        <PersonForm
          personId={person.id}
          submitLabel="Save changes"
          defaults={{
            name: person.name,
            relationship: person.relationship,
            email: person.email,
            likes: parseStoredList(person.likes).join(", "),
            dislikes: parseStoredList(person.dislikes).join(", "),
            hobbies: parseStoredList(person.hobbies).join(", "),
            budget: centsToDollarInput(person.defaultBudgetCents),
            notes: person.notes,
          }}
        />
      </div>
    </main>
  );
}
